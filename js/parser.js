/**
 * budget-parser.js
 * 엑셀(XLSX, XLS) 및 CSV 데이터를 정규화된 예산 데이터 객체로 변환
 */

(function (window) {
  'use strict';

  const BudgetParser = {
    /**
     * File 객체를 읽어 정규화된 데이터셋 반환 (Promise)
     * @param {File} file 
     * @returns {Promise<Object>}
     */
    async parseFile(file) {
      const fileName = file.name;
      const buffer = await file.arrayBuffer();

      // SheetJS 로드 확인
      if (typeof XLSX === 'undefined') {
        throw new Error('SheetJS(XLSX) 라이브러리가 로드되지 않았습니다.');
      }

      const workbook = XLSX.read(buffer, { type: 'array', cellFormula: true, cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      // raw 행 배열로 가져오기 (헤더 포함)
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      if (!rawRows || rawRows.length < 2) {
        throw new Error('유효한 데이터가 파일에 존재하지 않습니다.');
      }

      return this.normalizeRows(rawRows, fileName);
    },

    /**
     * raw row 배열을 파싱하여 정규화
     * @param {Array<Array>} rows
     * @param {string} sourceName
     */
    normalizeRows(rows, sourceName = '업로드 파일') {
      // 헤더 탐색 (첫 번째 행 또는 유효한 텍스트가 있는 행)
      let headerIdx = 0;
      for (let i = 0; i < Math.min(rows.length, 5); i++) {
        const rowStr = rows[i].join(' ');
        if (rowStr.includes('분야') || rowStr.includes('사업') || rowStr.includes('예산') || rowStr.includes('연번')) {
          headerIdx = i;
          break;
        }
      }

      const headers = rows[headerIdx].map(h => String(h || '').trim());
      const colMap = this.detectColumnMapping(headers);

      const items = [];
      for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.every(c => c === '' || c === null || c === undefined)) continue;

        const item = this.parseRowItem(row, colMap, i - headerIdx, headers);
        if (item.project || item.field) {
          items.push(item);
        }
      }

      if (items.length === 0) {
        throw new Error('파싱 가능한 예산 항목을 찾을 수 없습니다. 컬럼 양식을 확인해 주세요.');
      }

      return {
        sourceName,
        headers,
        detectedYears: colMap.years,
        items,
        parsedAt: new Date().toISOString()
      };
    },

    /**
     * 컬럼명 매핑 인덱스 탐지
     */
    detectColumnMapping(headers) {
      const map = {
        id: -1,
        field: -1,
        project: -1,
        unit: -1,
        valPrev: -1,
        valCurr: -1,
        valDiff: -1,
        rate: -1,
        notes: -1,
        years: { prev: '전년도', curr: '당해년도' }
      };

      headers.forEach((h, idx) => {
        const clean = h.toLowerCase().replace(/\s+/g, '');

        if (clean.includes('연번') || clean === 'no' || clean === '순번' || clean === 'id') {
          if (map.id === -1) map.id = idx;
        } else if (clean.includes('분야') || clean.includes('중점영역') || clean.includes('영역')) {
          if (map.field === -1) map.field = idx;
        } else if (clean.includes('세부사업') || clean.includes('주요지표') || clean.includes('사업명') || clean.includes('사업')) {
          if (map.project === -1) map.project = idx;
        } else if (clean.includes('구분/단위') || clean.includes('단위') || clean.includes('구분')) {
          if (map.unit === -1) map.unit = idx;
        } else if (clean.includes('증감') || clean.includes('차이') || clean.includes('(b-a)')) {
          if (map.valDiff === -1) map.valDiff = idx;
        } else if (clean.includes('증가율') || clean.includes('증감율') || clean.includes('변동율') || clean.includes('(%)')) {
          if (map.rate === -1) map.rate = idx;
        } else if (clean.includes('핵심내용') || clean.includes('보도자료') || clean.includes('원문') || clean.includes('근거') || clean.includes('비고')) {
          if (map.notes === -1) map.notes = idx;
        } else {
          // 연도 컬럼 감지 (예: 2026년(A), 2027년 정부안(B))
          const matchYear = h.match(/(\d{4})/);
          if (matchYear) {
            const yearNum = parseInt(matchYear[1], 10);
            if (map.valPrev === -1) {
              map.valPrev = idx;
              map.years.prev = h;
            } else if (map.valCurr === -1) {
              // 더 큰 연도가 당해년도
              const prevMatch = headers[map.valPrev].match(/(\d{4})/);
              const prevYearNum = prevMatch ? parseInt(prevMatch[1], 10) : 0;
              if (yearNum >= prevYearNum) {
                map.valCurr = idx;
                map.years.curr = h;
              } else {
                map.valCurr = map.valPrev;
                map.years.curr = headers[map.valPrev];
                map.valPrev = idx;
                map.years.prev = h;
              }
            }
          } else if (clean.includes('(a)') || clean.includes('전년')) {
            map.valPrev = idx;
            map.years.prev = h;
          } else if (clean.includes('(b)') || clean.includes('정부안') || clean.includes('당해')) {
            map.valCurr = idx;
            map.years.curr = h;
          }
        }
      });

      // 기본 폴백 (이미지 표준 순서 매핑)
      if (map.id === -1 && headers.length > 0) map.id = 0;
      if (map.field === -1 && headers.length > 1) map.field = 1;
      if (map.project === -1 && headers.length > 2) map.project = 2;
      if (map.unit === -1 && headers.length > 3) map.unit = 3;
      if (map.valPrev === -1 && headers.length > 4) map.valPrev = 4;
      if (map.valCurr === -1 && headers.length > 5) map.valCurr = 5;
      if (map.valDiff === -1 && headers.length > 6) map.valDiff = 6;
      if (map.rate === -1 && headers.length > 7) map.rate = 7;
      if (map.notes === -1 && headers.length > 8) map.notes = 8;

      return map;
    },

    /**
     * 개별 행 데이터 파싱 및 정규화
     */
    parseRowItem(row, colMap, indexFallback, headers) {
      const getVal = (idx) => (idx !== -1 && idx < row.length ? row[idx] : '');

      const id = String(getVal(colMap.id) || indexFallback).trim();
      const field = String(getVal(colMap.field) || '기타/미분류').trim();
      const project = String(getVal(colMap.project) || '').trim();
      const unit = String(getVal(colMap.unit) || '억원').trim();

      // 숫자 파싱
      const valPrev = this.parseNumber(getVal(colMap.valPrev));
      const valCurr = this.parseNumber(getVal(colMap.valCurr));
      
      let valDiff = colMap.valDiff !== -1 ? this.parseNumber(getVal(colMap.valDiff)) : null;
      if (valDiff === null || isNaN(valDiff)) {
        valDiff = (valCurr !== null ? valCurr : 0) - (valPrev !== null ? valPrev : 0);
      }

      // 원문 및 증가율 문자열
      const rawRate = getVal(colMap.rate);
      const notes = String(getVal(colMap.notes) || '').trim();

      // 신규 사업 여부 판정
      const rateStr = String(rawRate || '').trim();
      const isNew = this.checkIsNewProject(rateStr, notes, valPrev, valCurr);

      // 증가율 계산 (신규인 경우 '신규', 그 외는 % 표기)
      let rateDisplay = '';
      let rateNumeric = 0;

      if (isNew) {
        rateDisplay = '신규';
        rateNumeric = 9999; // 정렬 시 최상단 또는 별도 취급
      } else {
        const { display, numeric } = this.formatGrowthRate(rawRate, valPrev, valCurr, valDiff);
        rateDisplay = display;
        rateNumeric = numeric;
      }

      return {
        id,
        field,
        project,
        unit,
        valPrev: valPrev ?? 0,
        valCurr: valCurr ?? 0,
        valDiff: valDiff ?? 0,
        rateDisplay,
        rateNumeric,
        isNew,
        notes
      };
    },

    /**
     * 신규 사업 여부 판별 규칙
     */
    checkIsNewProject(rateStr, notes, valPrev, valCurr) {
      if (rateStr.includes('신규') || rateStr.toLowerCase().includes('new')) {
        return true;
      }
      if (notes.includes('[신규') || notes.includes('(신규') || notes.includes('신규 편성') || notes.includes('신규사업')) {
        return true;
      }
      // 전년도가 0원이고 당해년도 예산이 존재하는 경우
      if ((valPrev === 0 || valPrev === null) && (valCurr && valCurr > 0)) {
        return true;
      }
      return false;
    },

    /**
     * 숫자 파싱 헬퍼 (콤마, 공백, 기호 제거)
     */
    parseNumber(val) {
      if (val === null || val === undefined || val === '') return 0;
      if (typeof val === 'number') return isNaN(val) ? 0 : val;
      const clean = String(val).replace(/,/g, '').replace(/[^\d.-]/g, '').trim();
      const num = parseFloat(clean);
      return isNaN(num) ? 0 : num;
    },

    /**
     * 증가율 포맷팅
     */
    formatGrowthRate(rawRate, valPrev, valCurr, valDiff) {
      if (typeof rawRate === 'number') {
        // 0.349 형태 (엑셀 백분율 서식)
        if (Math.abs(rawRate) < 50 && rawRate !== 0) {
          const pct = rawRate * 100;
          return {
            display: (pct > 0 ? '+' : '') + pct.toFixed(1) + '%',
            numeric: pct
          };
        } else {
          return {
            display: (rawRate > 0 ? '+' : '') + rawRate.toFixed(1) + '%',
            numeric: rawRate
          };
        }
      }

      const str = String(rawRate || '').trim();
      if (str.includes('%')) {
        const num = parseFloat(str.replace(/,/g, '').replace('%', ''));
        return {
          display: str.startsWith('+') || num <= 0 ? str : `+${str}`,
          numeric: isNaN(num) ? 0 : num
        };
      }

      // 문자열이 없거나 계산 필요 시 valDiff / valPrev 로 계산
      if (valPrev && valPrev > 0) {
        const pct = (valDiff / valPrev) * 100;
        return {
          display: (pct > 0 ? '+' : '') + pct.toFixed(1) + '%',
          numeric: pct
        };
      }

      return { display: '-', numeric: 0 };
    }
  };

  window.BudgetParser = BudgetParser;
})(window);
