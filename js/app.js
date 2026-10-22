/**
 * app.js
 * 메인 대시보드 애플리케이션 컨트롤러
 */

(function () {
  'use strict';

  // DOM Elements Cache
  const els = {
    // Dropzone & File Input
    dropZone: document.getElementById('dropZone'),
    fileInput: document.getElementById('fileInput'),
    btnUploadTrigger: document.getElementById('btnUploadTrigger'),
    btnLoadSample: document.getElementById('btnLoadSample'),
    btnExportPng: document.getElementById('btnExportPng'),
    btnExportExcelHeader: document.getElementById('btnExportExcelHeader'),
    btnExportExcelTable: document.getElementById('btnExportExcelTable'),
    sourceNameDisplay: document.getElementById('sourceNameDisplay'),

    // KPI Summary
    kpiTotalCurr: document.getElementById('kpiTotalCurr'),
    kpiTotalDiff: document.getElementById('kpiTotalDiff'),
    kpiGrowthRate: document.getElementById('kpiGrowthRate'),
    kpiTotalCount: document.getElementById('kpiTotalCount'),
    kpiNewCount: document.getElementById('kpiNewCount'),
    kpiNewBudget: document.getElementById('kpiNewBudget'),
    kpiNewBudgetPct: document.getElementById('kpiNewBudgetPct'),

    // Year Labels
    lblCurrYear: document.getElementById('lblCurrYear'),
    lblPrevYear: document.getElementById('lblPrevYear'),

    // Tabs
    tabButtons: document.querySelectorAll('.tab-btn'),
    tabPanes: document.querySelectorAll('.tab-pane'),

    // Containers
    fieldCardsContainer: document.getElementById('fieldCardsContainer'),
    newProjectsGrid: document.getElementById('newProjectsGrid'),
    topGrowthList: document.getElementById('topGrowthList'),
    topDiffList: document.getElementById('topDiffList'),
    tableBody: document.getElementById('tableBody'),
    fieldFilterSelect: document.getElementById('fieldFilterSelect'),
    searchInput: document.getElementById('searchInput'),
    typeFilterBtns: document.querySelectorAll('[data-filter-type]'),
    tableCountDisplay: document.getElementById('tableCountDisplay'),

    // Modal
    detailModal: document.getElementById('detailModal'),
    modalCloseBtn: document.getElementById('modalCloseBtn'),
    modalBackdrop: document.getElementById('modalBackdrop'),
    modalContent: document.getElementById('modalContent')
  };

  /**
   * 애플리케이션 초기화
   */
  function init() {
    bindEvents();

    // Store 구독 등록
    window.budgetStore.subscribe((state) => {
      renderDashboard(state);
    });

    // 기본 내장 데이터 로드 (2027 국방예산)
    loadDefaultData();
  }

  /**
   * 이벤트 바인딩
   */
  function bindEvents() {
    // 파일 업로드 (클릭 및 드래그 앤 드롭)
    if (els.btnUploadTrigger && els.fileInput) {
      els.btnUploadTrigger.addEventListener('click', () => els.fileInput.click());
      els.fileInput.addEventListener('change', handleFileSelect);
    }

    if (els.dropZone) {
      ['dragenter', 'dragover'].forEach(eventName => {
        els.dropZone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          els.dropZone.classList.add('drag-active');
        }, false);
      });

      ['dragleave', 'drop'].forEach(eventName => {
        els.dropZone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          els.dropZone.classList.remove('drag-active');
        }, false);
      });

      els.dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files && files.length > 0) {
          processFile(files[0]);
        }
      });
    }

    // 샘플 데이터 재로드 버튼
    if (els.btnLoadSample) {
      els.btnLoadSample.addEventListener('click', () => loadDefaultData());
    }

    // 인포그래픽 이미지 저장(PNG)
    if (els.btnExportPng) {
      els.btnExportPng.addEventListener('click', exportDashboardAsPng);
    }

    // 엑셀 파일 저장 (.xlsx)
    if (els.btnExportExcelHeader) {
      els.btnExportExcelHeader.addEventListener('click', exportTableToExcel);
    }
    if (els.btnExportExcelTable) {
      els.btnExportExcelTable.addEventListener('click', exportTableToExcel);
    }

    // 탭 전환
    els.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        switchTab(targetTab);
      });
    });

    // 분야 필터 셀렉트
    if (els.fieldFilterSelect) {
      els.fieldFilterSelect.addEventListener('change', (e) => {
        window.budgetStore.setFilter('field', e.target.value);
      });
    }

    // 검색 인풋
    if (els.searchInput) {
      els.searchInput.addEventListener('input', (e) => {
        window.budgetStore.setFilter('search', e.target.value);
      });
    }

    // 사업 유형 필터 버튼 (전체 / 기존 / 신규)
    els.typeFilterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        els.typeFilterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const type = btn.getAttribute('data-filter-type');
        window.budgetStore.setFilter('type', type);
      });
    });

    // 테이블 헤더 정렬 클릭
    document.querySelectorAll('[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.getAttribute('data-sort');
        window.budgetStore.setSort(col);
      });
    });

    // 모달 닫기
    if (els.modalCloseBtn) {
      els.modalCloseBtn.addEventListener('click', closeModal);
    }
    if (els.modalBackdrop) {
      els.modalBackdrop.addEventListener('click', closeModal);
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  }

  /**
   * 탭 전환 처리
   */
  function switchTab(tabId) {
    els.tabButtons.forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tab') === tabId);
    });
    els.tabPanes.forEach(pane => {
      pane.classList.toggle('active', pane.id === tabId);
    });

    // 차트 리사이즈 갱신
    setTimeout(() => {
      window.budgetCharts.updateAll(window.budgetStore.state);
    }, 100);
  }

  /**
   * 파일 선택 핸들러
   */
  function handleFileSelect(e) {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  }

  /**
   * 엑셀/CSV 파일 파싱 및 스토어 로드
   */
  async function processFile(file) {
    try {
      showLoadingToast(`'${file.name}' 파싱 중...`);
      const parsedData = await window.BudgetParser.parseFile(file);
      window.budgetStore.loadDataset(parsedData);
      showToast(`'${file.name}' 데이터를 성공적으로 불러왔습니다!`, 'success');
    } catch (err) {
      console.error(err);
      showToast(`파일 처리 실패: ${err.message}`, 'error');
    }
  }

  /**
   * 기본 샘플 데이터 로드
   */
  function loadDefaultData() {
    if (window.DEFAULT_BUDGET_DATA && window.BudgetParser) {
      try {
        const rawRows = [];
        // headers
        const headers = ['연번', '분야 (중점영역)', '세부 사업 / 주요 지표', '구분/단위', '2026년 (A)', '2027년 정부안 (B)', '증감 (B-A)', '증가율 (%)', '핵심 내용 및 보도자료 박스 원문 근거'];
        rawRows.push(headers);
        window.DEFAULT_BUDGET_DATA.forEach(item => {
          rawRows.push([
            item['연번'],
            item['분야 (중점영역)'],
            item['세부 사업 / 주요 지표'],
            item['구분/단위'],
            item['2026년 (A)'],
            item['2027년 정부안 (B)'],
            item['증감 (B-A)'],
            item['증가율 (%)'],
            item['핵심 내용 및 보도자료 박스 원문 근거']
          ]);
        });
        const parsed = window.BudgetParser.normalizeRows(rawRows, '2027년 국방예산 정부안 (기본 데이터)');
        window.budgetStore.loadDataset(parsed);
      } catch (e) {
        console.error('기본 데이터 파싱 오류:', e);
      }
    }
  }

  /**
   * 전체 대시보드 렌더링
   */
  function renderDashboard(state) {
    renderMetaAndKPIs(state);
    renderFieldFilterOptions(state);
    renderFieldCards(state);
    renderNewProjectShowcase(state);
    renderTopRankings(state);
    renderDataTable(state);

    // 차트 업데이트
    window.budgetCharts.updateAll(state);
  }

  /**
   * 메타데이터 및 상단 KPI 렌더링
   */
  function renderMetaAndKPIs(state) {
    const { summary, meta } = state;

    if (els.sourceNameDisplay) {
      els.sourceNameDisplay.textContent = meta.sourceName;
    }
    if (els.lblCurrYear) els.lblCurrYear.textContent = meta.years.curr || '당해년도';
    if (els.lblPrevYear) els.lblPrevYear.textContent = meta.years.prev || '전년도';

    if (els.kpiTotalCurr) els.kpiTotalCurr.textContent = formatBudgetWithUnit(summary.totalCurr);
    if (els.kpiTotalDiff) {
      const sign = summary.totalDiff >= 0 ? '+' : '';
      els.kpiTotalDiff.textContent = `${sign}${formatBudgetWithUnit(summary.totalDiff)}`;
      els.kpiTotalDiff.className = summary.totalDiff >= 0 ? 'text-up font-bold' : 'text-down font-bold';
    }
    if (els.kpiGrowthRate) {
      els.kpiGrowthRate.textContent = summary.growthRateDisplay;
      els.kpiGrowthRate.className = summary.growthRate >= 0 ? 'badge badge-up' : 'badge badge-down';
    }
    if (els.kpiTotalCount) els.kpiTotalCount.textContent = `${summary.totalCount}개`;
    if (els.kpiNewCount) els.kpiNewCount.textContent = `${summary.newCount}개 사업`;
    if (els.kpiNewBudget) els.kpiNewBudget.textContent = formatBudgetWithUnit(summary.newBudgetTotal);
    if (els.kpiNewBudgetPct) els.kpiNewBudgetPct.textContent = `전체의 ${summary.newBudgetPct.toFixed(1)}%`;
  }

  /**
   * 분야 필터 옵션 동적 갱신
   */
  function renderFieldFilterOptions(state) {
    if (!els.fieldFilterSelect) return;
    const currentVal = els.fieldFilterSelect.value;
    els.fieldFilterSelect.innerHTML = `<option value="all">전체 분야 (${state.fields.length}개 영역)</option>`;

    state.fields.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f;
      opt.textContent = f;
      if (f === state.filters.field) opt.selected = true;
      els.fieldFilterSelect.appendChild(opt);
    });

    if (currentVal && state.fields.includes(currentVal)) {
      els.fieldFilterSelect.value = currentVal;
    }
  }

  /**
   * 분야별 인포그래픽 카드 렌더링
   */
  function renderFieldCards(state) {
    if (!els.fieldCardsContainer) return;
    els.fieldCardsContainer.innerHTML = '';

    const stats = Object.values(state.fieldStats);

    stats.forEach(stat => {
      const isSelected = state.filters.field === stat.name;
      const card = document.createElement('div');
      card.className = `field-card ${isSelected ? 'selected' : ''}`;
      
      const badgeClass = stat.growthRate >= 0 ? 'badge-up' : 'badge-down';

      card.innerHTML = `
        <div class="field-card-header">
          <div class="field-name-wrap">
            <span class="field-title">${stat.name}</span>
          </div>
          <span class="badge ${badgeClass}">${stat.growthRateDisplay}</span>
        </div>
        <div class="field-card-body">
          <div class="field-stat-row">
            <span class="stat-label">당해 예산</span>
            <span class="stat-value text-primary">${stat.totalCurr.toLocaleString()}억원</span>
          </div>
          <div class="field-stat-row text-muted">
            <span class="stat-label">전년 대비 증감</span>
            <span class="stat-value">${stat.totalDiff >= 0 ? '+' : ''}${stat.totalDiff.toLocaleString()}억원</span>
          </div>
          <div class="field-progress-wrap">
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width: ${Math.min(stat.sharePct, 100)}%;"></div>
            </div>
            <span class="progress-text">점유율 ${stat.sharePct.toFixed(1)}%</span>
          </div>
        </div>
        <div class="field-card-footer">
          <span class="badge-tag">총 ${stat.items.length}개 사업</span>
          ${stat.newCount > 0 ? `<span class="badge-tag badge-new">신규 ${stat.newCount}개</span>` : ''}
          <button class="btn-field-detail" title="이 분야만 필터링">${isSelected ? '필터 해제' : '선택 보기 →'}</button>
        </div>
      `;

      card.addEventListener('click', () => {
        const nextField = isSelected ? 'all' : stat.name;
        window.budgetStore.setFilter('field', nextField);
        if (els.fieldFilterSelect) els.fieldFilterSelect.value = nextField;
      });

      els.fieldCardsContainer.appendChild(card);
    });
  }

  /**
   * 신규 사업 전용 쇼케이스 카드 그리드 렌더링
   */
  function renderNewProjectShowcase(state) {
    if (!els.newProjectsGrid) return;
    els.newProjectsGrid.innerHTML = '';

    const newProjects = window.budgetStore.getNewProjects();

    if (newProjects.length === 0) {
      els.newProjectsGrid.innerHTML = `
        <div class="empty-state">
          <p>등록된 신규 착수 사업이 없습니다.</p>
        </div>
      `;
      return;
    }

    newProjects.forEach(item => {
      const card = document.createElement('div');
      card.className = 'new-project-card';
      card.innerHTML = `
        <div class="new-card-badge-row">
          <span class="badge badge-new-pill">NEW 신규사업</span>
          <span class="badge-field">${item.field}</span>
        </div>
        <h4 class="new-project-title">${item.project}</h4>
        <div class="new-project-budget-box">
          <span class="budget-label">2027년 정부안</span>
          <span class="budget-amount">${item.valCurr.toLocaleString()}<span class="unit">${item.unit}</span></span>
        </div>
        <div class="new-project-notes">
          <i class="quote-icon">“</i>
          <p>${escapeHtml(item.notes || '상세 보도자료 근거 없음')}</p>
        </div>
        <div class="new-card-footer">
          <button class="btn-card-more">세부 근거 열람</button>
        </div>
      `;

      card.querySelector('.btn-card-more').addEventListener('click', (e) => {
        e.stopPropagation();
        openDetailModal(item);
      });
      card.addEventListener('click', () => openDetailModal(item));

      els.newProjectsGrid.appendChild(card);
    });
  }

  /**
   * 상위 랭킹 리스트 렌더링
   */
  function renderTopRankings(state) {
    // 1. 증가율 Top 5
    if (els.topGrowthList) {
      els.topGrowthList.innerHTML = '';
      const topGrowth = window.budgetStore.getTopGrowthProjects(5);
      topGrowth.forEach((p, idx) => {
        const li = document.createElement('div');
        li.className = 'ranking-item';
        li.innerHTML = `
          <div class="rank-badge rank-${idx + 1}">${idx + 1}</div>
          <div class="rank-info">
            <div class="rank-name" title="${p.project}">${p.project}</div>
            <div class="rank-field">${p.field}</div>
          </div>
          <div class="rank-stat text-right">
            <span class="badge badge-up">${p.rateDisplay}</span>
            <div class="text-xs text-muted">+${p.valDiff.toLocaleString()}${p.unit}</div>
          </div>
        `;
        li.addEventListener('click', () => openDetailModal(p));
        els.topGrowthList.appendChild(li);
      });
    }

    // 2. 증감액 Top 5
    if (els.topDiffList) {
      els.topDiffList.innerHTML = '';
      const topDiff = window.budgetStore.getTopDiffProjects(5);
      topDiff.forEach((p, idx) => {
        const li = document.createElement('div');
        li.className = 'ranking-item';
        li.innerHTML = `
          <div class="rank-badge rank-${idx + 1}">${idx + 1}</div>
          <div class="rank-info">
            <div class="rank-name" title="${p.project}">${p.project}</div>
            <div class="rank-field">${p.field}</div>
          </div>
          <div class="rank-stat text-right">
            <span class="font-bold text-primary">+${p.valDiff.toLocaleString()}${p.unit}</span>
            <div class="text-xs text-muted">${p.rateDisplay}</div>
          </div>
        `;
        li.addEventListener('click', () => openDetailModal(p));
        els.topDiffList.appendChild(li);
      });
    }
  }

  /**
   * 상세 데이터 테이블 렌더링
   */
  function renderDataTable(state) {
    if (!els.tableBody) return;
    els.tableBody.innerHTML = '';

    const items = state.filteredItems;
    if (els.tableCountDisplay) {
      els.tableCountDisplay.textContent = `총 ${items.length}개 사업 표시 중 (전체 ${state.rawItems.length}개)`;
    }

    if (items.length === 0) {
      els.tableBody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-8 text-muted">
            일치하는 예산 사업이 없습니다. 필터 조건을 변경해 보세요.
          </td>
        </tr>
      `;
      return;
    }

    items.forEach((item, idx) => {
      const tr = document.createElement('tr');
      tr.className = item.isNew ? 'row-new-project' : '';

      const diffClass = item.valDiff > 0 ? 'text-up' : item.valDiff < 0 ? 'text-down' : '';
      const rateBadge = item.isNew
        ? '<span class="badge badge-new">신규</span>'
        : `<span class="badge ${item.valDiff >= 0 ? 'badge-up' : 'badge-down'}">${item.rateDisplay}</span>`;

      tr.innerHTML = `
        <td class="text-center">${item.id || (idx + 1)}</td>
        <td><span class="badge-field-sm">${item.field}</span></td>
        <td class="font-medium project-name-cell">
          ${item.isNew ? '<span class="badge-tag badge-new mr-1">NEW</span>' : ''}
          ${escapeHtml(item.project)}
        </td>
        <td class="text-center text-muted">${item.unit}</td>
        <td class="text-right">${item.valPrev ? item.valPrev.toLocaleString() : '-'}</td>
        <td class="text-right font-bold text-primary">${item.valCurr.toLocaleString()}</td>
        <td class="text-right font-semibold ${diffClass}">
          ${item.valDiff > 0 ? '+' : ''}${item.valDiff.toLocaleString()}
        </td>
        <td class="text-center">${rateBadge}</td>
      `;

      tr.addEventListener('click', () => openDetailModal(item));
      els.tableBody.appendChild(tr);
    });
  }

  /**
   * 세부 내역 모달 팝업 오픈
   */
  function openDetailModal(item) {
    if (!els.detailModal || !els.modalContent) return;

    els.modalContent.innerHTML = `
      <div class="modal-item-header">
        <div class="modal-badge-row">
          <span class="badge-field">${item.field}</span>
          ${item.isNew ? '<span class="badge badge-new">신규 착수 사업</span>' : '<span class="badge badge-outline">기존 추진 사업</span>'}
          <span class="badge-tag">연번 ${item.id}</span>
        </div>
        <h2 class="modal-project-title">${escapeHtml(item.project)}</h2>
      </div>

      <div class="modal-stats-grid">
        <div class="modal-stat-card">
          <div class="stat-card-label">2026년 예산</div>
          <div class="stat-card-val">${item.valPrev ? item.valPrev.toLocaleString() : '0'} <span class="unit">${item.unit}</span></div>
        </div>
        <div class="modal-stat-card primary">
          <div class="stat-card-label">2027년 정부안</div>
          <div class="stat-card-val text-primary">${item.valCurr.toLocaleString()} <span class="unit">${item.unit}</span></div>
        </div>
        <div class="modal-stat-card">
          <div class="stat-card-label">전년 대비 증감액</div>
          <div class="stat-card-val ${item.valDiff >= 0 ? 'text-up' : 'text-down'}">
            ${item.valDiff > 0 ? '+' : ''}${item.valDiff.toLocaleString()} <span class="unit">${item.unit}</span>
          </div>
        </div>
        <div class="modal-stat-card">
          <div class="stat-card-label">증가율</div>
          <div class="stat-card-val">
            ${item.isNew ? '<span class="text-teal font-bold">신규 편성</span>' : item.rateDisplay}
          </div>
        </div>
      </div>

      <div class="modal-notes-section">
        <h4 class="notes-heading">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          핵심 내용 및 보도자료 박스 원문 근거
        </h4>
        <div class="notes-content-box">
          <p>${escapeHtml(item.notes || '보도자료 원문 설명이 기재되지 않은 항목입니다.')}</p>
        </div>
      </div>
    `;

    els.detailModal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (els.detailModal) {
      els.detailModal.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  /**
   * 대시보드 인포그래픽 이미지(PNG) 내보내기
   */
  async function exportDashboardAsPng() {
    if (typeof html2canvas === 'undefined') {
      showToast('html2canvas 라이브러리가 로드되지 않았습니다.', 'error');
      return;
    }

    const captureArea = document.getElementById('captureDashboardArea');
    if (!captureArea) return;

    try {
      showLoadingToast('대시보드 인포그래픽 이미지 캡처 중...');
      const canvas = await html2canvas(captureArea, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#f8fafc',
        logging: false
      });

      const link = document.createElement('a');
      link.download = `예산대시보드_인포그래픽_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('인포그래픽 이미지가 성공적으로 다운로드되었습니다!', 'success');
    } catch (e) {
      console.error(e);
      showToast('이미지 저장 실패: ' + e.message, 'error');
    }
  }

  /**
   * 전체 사업 데이터 목록을 엑셀 파일(.xlsx)로 내보내기
   */
  function exportTableToExcel() {
    if (typeof XLSX === 'undefined') {
      showToast('SheetJS(XLSX) 라이브러리가 로드되지 않았습니다.', 'error');
      return;
    }

    const state = window.budgetStore.state;
    const items = state.filteredItems && state.filteredItems.length > 0
      ? state.filteredItems
      : state.rawItems;

    if (!items || items.length === 0) {
      showToast('내보낼 사업 데이터가 없습니다.', 'error');
      return;
    }

    try {
      showLoadingToast('엑셀 파일 생성 중...');

      const prevYearHeader = state.meta.years.prev || '2026년 (A)';
      const currYearHeader = state.meta.years.curr || '2027년 정부안 (B)';

      // 1. 헤더 행 정의
      const headers = [
        '연번',
        '분야 (중점영역)',
        '세부 사업 / 주요 지표',
        '구분/단위',
        prevYearHeader,
        currYearHeader,
        '증감 (B-A)',
        '증가율 (%)',
        '핵심 내용 및 보도자료 박스 원문 근거'
      ];

      // 2. 데이터 행 변환
      const dataRows = items.map((item, idx) => {
        return [
          item.id || (idx + 1),
          item.field || '',
          item.project || '',
          item.unit || '억원',
          item.valPrev,
          item.valCurr,
          item.valDiff,
          item.isNew ? '신규' : item.rateDisplay,
          item.notes || ''
        ];
      });

      // 3. 워크시트 생성
      const wsData = [headers, ...dataRows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // 열 너비 설정
      ws['!cols'] = [
        { wch: 8 },   // 연번
        { wch: 28 },  // 분야
        { wch: 38 },  // 세부 사업
        { wch: 10 },  // 단위
        { wch: 16 },  // 전년도
        { wch: 18 },  // 정부안
        { wch: 14 },  // 증감
        { wch: 14 },  // 증가율
        { wch: 75 }   // 핵심 내용
      ];

      // 4. 워크북 생성 및 파일 쓰기
      const wb = XLSX.utils.book_new();
      const sheetName = '주요사업_예산내역';
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const timeStr = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
      const fileName = `예산사업목록_결과_${dateStr}_${timeStr}.xlsx`;

      XLSX.writeFile(wb, fileName);
      showToast(`총 ${items.length}개 사업 내역이 '${fileName}'으로 다운로드되었습니다!`, 'success');
    } catch (err) {
      console.error(err);
      showToast('엑셀 저장 실패: ' + err.message, 'error');
    }
  }

  /**
   * 금액 표기 헬퍼 (조 / 억원 단위)
   */
  function formatBudgetWithUnit(val) {
    if (val === null || val === undefined || isNaN(val)) return '0억원';
    const isNeg = val < 0;
    const absVal = Math.abs(val);

    if (absVal >= 10000) {
      const jo = Math.floor(absVal / 10000);
      const eok = Math.round(absVal % 10000);
      const prefix = isNeg ? '-' : '';
      if (eok === 0) return `${prefix}${jo}조원`;
      return `${prefix}${jo}조 ${eok.toLocaleString()}억원`;
    }
    return `${isNeg ? '-' : ''}${absVal.toLocaleString()}억원`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * 토스트 알림 헬퍼
   */
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function showLoadingToast(message) {
    showToast(message, 'info');
  }

  // DOM 로드 완료 후 실행
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
