/**
 * news_reader_app - 무한 스크롤 엔진 및 사용자 인터랙션 오케스트레이션
 * - IntersectionObserver + 윈도우 스크롤 이중 백업으로 100% 무한 스크롤 보장
 * - 매끄러운 10건 추가 로딩 및 토스트/모달 인터랙션
 */

(function () {
  let isLoading = false;
  let hasMoreArticles = true;
  let scrollObserver = null;
  let scrollThrottleTimer = null;

  // DOM 엘리먼트
  const topicChips = document.querySelectorAll('.topic-chip');
  const btnFetchNews = document.getElementById('btnFetchNews');
  const btnOpenSettings = document.getElementById('btnOpenSettings');
  const scrollSentinel = document.getElementById('scrollSentinel');

  // 모달
  const modalOverlay = document.getElementById('modalOverlay');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const settingsModalOverlay = document.getElementById('settingsModalOverlay');
  const settingsModalCloseBtn = document.getElementById('settingsModalCloseBtn');

  /**
   * 체크된 주제 목록 반환
   */
  function getSelectedTopics() {
    const checked = document.querySelectorAll('.topic-chip input[type="checkbox"]:checked');
    return Array.from(checked).map(input => input.value);
  }

  /**
   * 칩 토글 인터랙션
   */
  function setupTopicChips() {
    topicChips.forEach(chip => {
      const checkbox = chip.querySelector('input[type="checkbox"]');
      
      const updateState = () => {
        if (checkbox.checked) {
          chip.classList.add('active');
        } else {
          chip.classList.remove('active');
        }
      };

      updateState();
      checkbox.addEventListener('change', updateState);
    });
  }

  /**
   * 초기 뉴스 로드 (요구사항 1, 2)
   */
  async function loadInitialNews() {
    if (isLoading) return;

    const selectedTopics = getSelectedTopics();
    if (selectedTopics.length === 0) {
      NewsUI.showToast('최소 하나 이상의 주제를 선택해 주세요.', 'error');
      NewsUI.showEmptyState(true);
      NewsUI.updateActiveTopicsDisplay([]);
      return;
    }

    try {
      isLoading = true;
      hasMoreArticles = true;
      NewsUI.showLoading(true, '최신 헤드라인을 가져오는 중입니다...');
      NewsUI.showEndOfFeed(false);
      NewsUI.updateActiveTopicsDisplay(selectedTopics);

      const result = await NewsAPI.fetchInitialNews(selectedTopics);

      if (!result.initialArticles || result.initialArticles.length === 0) {
        NewsUI.renderArticles([], false);
        NewsUI.showToast('뉴스를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', 'error');
      } else {
        NewsUI.renderArticles(result.initialArticles, false);
        NewsUI.showToast(`✨ ${selectedTopics.length}개 주제의 상위 헤드라인을 불러왔습니다.`, 'success');
      }

      // 무한 스크롤 감지기 셋업
      setupInfiniteScroll();

    } catch (err) {
      console.error('뉴스 로딩 오류:', err);
      NewsUI.showToast('뉴스 로딩 중 문제가 발생했습니다.', 'error');
    } finally {
      isLoading = false;
      NewsUI.showLoading(false);
    }
  }

  /**
   * 최하단 도달 시 추가 10건 로드 (요구사항 4)
   */
  async function loadMoreNews() {
    if (isLoading || !hasMoreArticles) return;

    try {
      isLoading = true;
      NewsUI.showLoading(true, '기사 10건을 더 불러오는 중입니다...');

      // 부드러운 스크롤 UX를 위해 미세 딜레이 (300ms)
      await new Promise(r => setTimeout(r, 250));

      const { articles, hasMore } = await NewsAPI.loadNextArticles(10);

      if (articles && articles.length > 0) {
        NewsUI.renderArticles(articles, true);
      }

      hasMoreArticles = hasMore;
      if (!hasMoreArticles) {
        NewsUI.showEndOfFeed(true);
      }
    } catch (err) {
      console.error('무한 스크롤 추가 로드 오류:', err);
    } finally {
      isLoading = false;
      NewsUI.showLoading(false);
    }
  }

  /**
   * IntersectionObserver + Window Scroll 이중 감지기 설정
   */
  function setupInfiniteScroll() {
    // 1. 기존 IntersectionObserver 해제 및 재등록
    if (scrollObserver) {
      scrollObserver.disconnect();
    }

    const observerOptions = {
      root: null,
      rootMargin: '350px 0px', // 바닥에 도달하기 350px 전에 미리 호출하여 끊김 없는 로딩 경험
      threshold: 0.05
    };

    scrollObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !isLoading && hasMoreArticles) {
          loadMoreNews();
        }
      });
    }, observerOptions);

    if (scrollSentinel) {
      scrollObserver.observe(scrollSentinel);
    }

    // 2. Window Scroll 이벤트 이중 백업 (어떤 환경에서도 100% 무한 스크롤 발화)
    window.removeEventListener('scroll', handleWindowScroll);
    window.addEventListener('scroll', handleWindowScroll, { passive: true });
  }

  function handleWindowScroll() {
    if (isLoading || !hasMoreArticles) return;

    if (!scrollThrottleTimer) {
      scrollThrottleTimer = setTimeout(() => {
        scrollThrottleTimer = null;
        const scrollPosition = window.innerHeight + window.scrollY;
        const threshold = document.documentElement.scrollHeight - 400; // 바닥 400px 전

        if (scrollPosition >= threshold) {
          loadMoreNews();
        }
      }, 150);
    }
  }

  /**
   * 모달 이벤트 리스너 설정
   */
  function setupModals() {
    // 본문 읽기 모달
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', NewsUI.closeArticleModal);
    if (modalOverlay) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) NewsUI.closeArticleModal();
      });
    }

    // API 설정 모달
    if (btnOpenSettings) {
      btnOpenSettings.addEventListener('click', () => {
        settingsModalOverlay.classList.remove('hidden');
        document.body.classList.add('modal-open');
      });
    }

    if (settingsModalCloseBtn) {
      settingsModalCloseBtn.addEventListener('click', () => {
        settingsModalOverlay.classList.add('hidden');
        document.body.classList.remove('modal-open');
      });
    }

    if (settingsModalOverlay) {
      settingsModalOverlay.addEventListener('click', (e) => {
        if (e.target === settingsModalOverlay) {
          settingsModalOverlay.classList.add('hidden');
          document.body.classList.remove('modal-open');
        }
      });
    }

    // ESC 키 닫기
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        NewsUI.closeArticleModal();
        if (settingsModalOverlay) settingsModalOverlay.classList.add('hidden');
        document.body.classList.remove('modal-open');
      }
    });
  }

  /**
   * 전체 선택 / 해제 토글 버튼 지원
   */
  function setupTopicHelpers() {
    const btnSelectAll = document.getElementById('btnSelectAll');
    if (btnSelectAll) {
      btnSelectAll.addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('.topic-chip input[type="checkbox"]');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        checkboxes.forEach(cb => {
          cb.checked = !allChecked;
          const chip = cb.closest('.topic-chip');
          if (chip) {
            chip.classList.toggle('active', !allChecked);
          }
        });
        btnSelectAll.textContent = allChecked ? '모두 선택' : '모두 해제';
      });
    }
  }

  function init() {
    setupTopicChips();
    setupTopicHelpers();
    setupModals();

    if (btnFetchNews) {
      btnFetchNews.addEventListener('click', loadInitialNews);
    }

    // 초기 로드 실행
    loadInitialNews();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
