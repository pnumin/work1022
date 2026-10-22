/**
 * charts.js
 * Chart.js 기반 인포그래픽 시각화 렌더러
 */

(function (window) {
  'use strict';

  // 시각화 전용 모던 비즈니스 컬러 팔레트
  const PALETTE = [
    '#2563eb', // Blue
    '#0d9488', // Teal
    '#7c3aed', // Purple
    '#ea580c', // Orange
    '#059669', // Emerald
    '#db2777', // Pink
    '#4f46e5', // Indigo
    '#d97706', // Amber
    '#0284c7', // Sky
    '#64748b'  // Slate
  ];

  class BudgetCharts {
    constructor() {
      this.charts = {
        fieldDonut: null,
        fieldCompare: null,
        newProjectsField: null,
        topRank: null
      };
    }

    /**
     * 전체 차트 일괄 갱신
     */
    updateAll(state) {
      if (typeof Chart === 'undefined') {
        console.warn('Chart.js가 로드되지 않아 차트를 렌더링할 수 없습니다.');
        return;
      }

      this.renderFieldDonut(state);
      this.renderFieldCompare(state);
      this.renderNewProjectsField(state);
      this.renderTopRank(state);
    }

    /**
     * 1. 분야별 예산 점유율 도넛 차트
     */
    renderFieldDonut(state) {
      const ctx = document.getElementById('chartFieldDonut');
      if (!ctx) return;

      const stats = Object.values(state.fieldStats);
      const labels = stats.map(s => this.shortenLabel(s.name));
      const data = stats.map(s => Math.round(s.totalCurr));
      const colors = labels.map((_, i) => PALETTE[i % PALETTE.length]);

      if (this.charts.fieldDonut) {
        this.charts.fieldDonut.destroy();
      }

      this.charts.fieldDonut = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: colors,
            borderColor: '#ffffff',
            borderWidth: 2,
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '68%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                boxWidth: 12,
                boxHeight: 12,
                padding: 14,
                font: { family: 'Pretendard, sans-serif', size: 12 }
              }
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const val = context.raw;
                  const total = data.reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
                  return ` ${context.label}: ${val.toLocaleString()}억원 (${pct}%)`;
                }
              }
            }
          }
        }
      });
    }

    /**
     * 2. 분야별 전년 vs 당해년도 예산 비교 막대 차트
     */
    renderFieldCompare(state) {
      const ctx = document.getElementById('chartFieldCompare');
      if (!ctx) return;

      const stats = Object.values(state.fieldStats);
      const labels = stats.map(s => this.shortenLabel(s.name));
      const prevData = stats.map(s => Math.round(s.totalPrev));
      const currData = stats.map(s => Math.round(s.totalCurr));

      const prevYearLabel = state.meta.years.prev || '전년도';
      const currYearLabel = state.meta.years.curr || '당해년도';

      if (this.charts.fieldCompare) {
        this.charts.fieldCompare.destroy();
      }

      this.charts.fieldCompare = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: prevYearLabel,
              data: prevData,
              backgroundColor: 'rgba(148, 163, 184, 0.75)',
              borderRadius: 4
            },
            {
              label: currYearLabel,
              data: currData,
              backgroundColor: 'rgba(37, 99, 235, 0.9)',
              borderRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { family: 'Pretendard, sans-serif', size: 11 } }
            },
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(226, 232, 240, 0.6)' },
              ticks: {
                callback: (value) => value >= 10000 ? `${(value / 10000).toFixed(1)}조` : `${value.toLocaleString()}억`,
                font: { family: 'Pretendard, sans-serif', size: 11 }
              }
            }
          },
          plugins: {
            legend: {
              position: 'top',
              align: 'end',
              labels: {
                boxWidth: 12,
                font: { family: 'Pretendard, sans-serif', size: 12 }
              }
            },
            tooltip: {
              callbacks: {
                afterBody: (context) => {
                  const idx = context[0].dataIndex;
                  const diff = currData[idx] - prevData[idx];
                  const sign = diff >= 0 ? '+' : '';
                  return `\n증감: ${sign}${diff.toLocaleString()}억원`;
                }
              }
            }
          }
        }
      });
    }

    /**
     * 3. 분야별 신규사업 예산 규모 차트
     */
    renderNewProjectsField(state) {
      const ctx = document.getElementById('chartNewProjectsField');
      if (!ctx) return;

      const stats = Object.values(state.fieldStats).filter(s => s.newBudget > 0);
      const labels = stats.map(s => this.shortenLabel(s.name));
      const data = stats.map(s => Math.round(s.newBudget));
      const counts = stats.map(s => s.newCount);

      if (this.charts.newProjectsField) {
        this.charts.newProjectsField.destroy();
      }

      this.charts.newProjectsField = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: '신규사업 예산(억원)',
            data,
            backgroundColor: 'rgba(13, 148, 136, 0.85)',
            hoverBackgroundColor: 'rgba(15, 118, 110, 1)',
            borderRadius: 6
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              beginAtZero: true,
              grid: { color: 'rgba(226, 232, 240, 0.6)' },
              ticks: { font: { family: 'Pretendard, sans-serif', size: 11 } }
            },
            y: {
              grid: { display: false },
              ticks: { font: { family: 'Pretendard, sans-serif', size: 12, weight: '500' } }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const idx = context.dataIndex;
                  return ` 신규 예산: ${context.raw.toLocaleString()}억원 (신규 ${counts[idx]}건)`;
                }
              }
            }
          }
        }
      });
    }

    /**
     * 4. 상위 증감액 사업 Top 5 가로 막대 차트
     */
    renderTopRank(state) {
      const ctx = document.getElementById('chartTopRank');
      if (!ctx) return;

      const topProjects = window.budgetStore.getTopDiffProjects(5);
      const labels = topProjects.map(p => this.truncate(p.project, 16));
      const data = topProjects.map(p => Math.round(p.valDiff));

      if (this.charts.topRank) {
        this.charts.topRank.destroy();
      }

      this.charts.topRank = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: '증감액 (억원)',
            data,
            backgroundColor: 'rgba(234, 88, 12, 0.85)',
            borderRadius: 4
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              beginAtZero: true,
              grid: { color: 'rgba(226, 232, 240, 0.6)' },
              ticks: {
                callback: (val) => val >= 10000 ? `${(val / 10000).toFixed(1)}조` : `${val.toLocaleString()}억`,
                font: { family: 'Pretendard, sans-serif', size: 11 }
              }
            },
            y: {
              grid: { display: false },
              ticks: { font: { family: 'Pretendard, sans-serif', size: 11 } }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => ` +${ctx.raw.toLocaleString()}억원 증액`
              }
            }
          }
        }
      });
    }

    /**
     * 레이블 축약 헬퍼
     */
    shortenLabel(name) {
      if (!name) return '';
      // '① 자주국방 & 전작권 전환' -> '자주국방' 또는 번호 제거 축약
      return name.replace(/^[①-⑩\d\.\s]+/, '').trim().split('&')[0].trim();
    }

    truncate(str, max) {
      if (!str) return '';
      return str.length > max ? str.substring(0, max) + '...' : str;
    }
  }

  window.budgetCharts = new BudgetCharts();
})(window);
