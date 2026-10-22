/**
 * data-store.js
 * 대시보드 상태 관리, 통계 집계, 필터링 및 이벤트 브로드캐스팅
 */

(function (window) {
  'use strict';

  class BudgetStore {
    constructor() {
      this.listeners = [];
      this.state = {
        meta: {
          title: '2027년 국방예산 정부안 주요사업 대시보드',
          sourceName: '기본 샘플 데이터 (2027년_국방예산.xlsx)',
          years: { prev: '2026년', curr: '2027년 정부안' }
        },
        rawItems: [],
        filteredItems: [],
        fields: [], // 분야 목록
        fieldStats: {}, // 분야별 통계
        summary: {
          totalPrev: 0,
          totalCurr: 0,
          totalDiff: 0,
          growthRate: 0,
          growthRateDisplay: '0%',
          totalCount: 0,
          newCount: 0,
          newBudgetTotal: 0,
          newBudgetPct: 0
        },
        filters: {
          field: 'all',
          type: 'all', // 'all', 'new', 'existing'
          search: '',
          sortBy: 'id',
          sortOrder: 'asc'
        }
      };
    }

    subscribe(listener) {
      this.listeners.push(listener);
      return () => {
        this.listeners = this.listeners.filter(l => l !== listener);
      };
    }

    notify() {
      this.listeners.forEach(fn => fn(this.state));
    }

    /**
     * 정규화된 데이터셋으로 상태 초기화
     */
    loadDataset(parsedData) {
      this.state.meta.sourceName = parsedData.sourceName || '사용자 업로드 파일';
      if (parsedData.detectedYears) {
        this.state.meta.years = parsedData.detectedYears;
      }
      this.state.rawItems = parsedData.items || [];
      this.state.filters.field = 'all';
      this.state.filters.type = 'all';
      this.state.filters.search = '';

      this.recalculate();
      this.applyFilters();
      this.notify();
    }

    /**
     * 전체 통계 및 분야별 통계 산출
     */
    recalculate() {
      const items = this.state.rawItems;
      let totalPrev = 0;
      let totalCurr = 0;
      let newCount = 0;
      let newBudgetTotal = 0;

      const fieldMap = {};

      items.forEach(item => {
        totalPrev += item.valPrev;
        totalCurr += item.valCurr;

        if (item.isNew) {
          newCount++;
          newBudgetTotal += item.valCurr;
        }

        const fName = item.field;
        if (!fieldMap[fName]) {
          fieldMap[fName] = {
            name: fName,
            items: [],
            totalPrev: 0,
            totalCurr: 0,
            totalDiff: 0,
            newCount: 0,
            newBudget: 0
          };
        }

        fieldMap[fName].items.push(item);
        fieldMap[fName].totalPrev += item.valPrev;
        fieldMap[fName].totalCurr += item.valCurr;
        fieldMap[fName].totalDiff += item.valDiff;
        if (item.isNew) {
          fieldMap[fName].newCount++;
          fieldMap[fName].newBudget += item.valCurr;
        }
      });

      const totalDiff = totalCurr - totalPrev;
      const growthRate = totalPrev > 0 ? (totalDiff / totalPrev) * 100 : 0;
      const growthRateDisplay = (growthRate > 0 ? '+' : '') + growthRate.toFixed(1) + '%';
      const newBudgetPct = totalCurr > 0 ? (newBudgetTotal / totalCurr) * 100 : 0;

      this.state.summary = {
        totalPrev,
        totalCurr,
        totalDiff,
        growthRate,
        growthRateDisplay,
        totalCount: items.length,
        newCount,
        newBudgetTotal,
        newBudgetPct
      };

      // 분야별 점유율 및 증가율 산출
      this.state.fields = Object.keys(fieldMap);
      this.state.fieldStats = {};

      Object.values(fieldMap).forEach(f => {
        const fGrowth = f.totalPrev > 0 ? (f.totalDiff / f.totalPrev) * 100 : 0;
        const sharePct = totalCurr > 0 ? (f.totalCurr / totalCurr) * 100 : 0;

        this.state.fieldStats[f.name] = {
          ...f,
          growthRate: fGrowth,
          growthRateDisplay: (fGrowth > 0 ? '+' : '') + fGrowth.toFixed(1) + '%',
          sharePct: sharePct
        };
      });
    }

    /**
     * 필터 및 검색 적용
     */
    applyFilters() {
      const { field, type, search, sortBy, sortOrder } = this.state.filters;
      let list = [...this.state.rawItems];

      // 분야 필터
      if (field !== 'all') {
        list = list.filter(item => item.field === field);
      }

      // 사업 유형 필터
      if (type === 'new') {
        list = list.filter(item => item.isNew);
      } else if (type === 'existing') {
        list = list.filter(item => !item.isNew);
      }

      // 검색어 필터
      if (search && search.trim() !== '') {
        const kw = search.trim().toLowerCase();
        list = list.filter(item =>
          item.project.toLowerCase().includes(kw) ||
          item.field.toLowerCase().includes(kw) ||
          item.notes.toLowerCase().includes(kw)
        );
      }

      // 정렬
      list.sort((a, b) => {
        let valA = a[sortBy];
        let valB = b[sortBy];

        if (sortBy === 'id') {
          valA = parseFloat(valA) || 0;
          valB = parseFloat(valB) || 0;
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });

      this.state.filteredItems = list;
    }

    setFilter(key, value) {
      if (this.state.filters[key] !== value) {
        this.state.filters[key] = value;
        this.applyFilters();
        this.notify();
      }
    }

    setSort(column) {
      if (this.state.filters.sortBy === column) {
        this.state.filters.sortOrder = this.state.filters.sortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        this.state.filters.sortBy = column;
        this.state.filters.sortOrder = (column === 'valCurr' || column === 'valDiff' || column === 'rateNumeric') ? 'desc' : 'asc';
      }
      this.applyFilters();
      this.notify();
    }

    /**
     * 신규 사업 리스트 반환
     */
    getNewProjects() {
      return this.state.rawItems.filter(item => item.isNew);
    }

    /**
     * 증감액 상위 N개 사업
     */
    getTopDiffProjects(n = 5) {
      return [...this.state.rawItems]
        .sort((a, b) => b.valDiff - a.valDiff)
        .slice(0, n);
    }

    /**
     * 증가율 상위 N개 사업 (신규 제외 기존사업 중)
     */
    getTopGrowthProjects(n = 5) {
      return this.state.rawItems
        .filter(item => !item.isNew && item.valPrev > 0)
        .sort((a, b) => b.rateNumeric - a.rateNumeric)
        .slice(0, n);
    }
  }

  window.budgetStore = new BudgetStore();
})(window);
