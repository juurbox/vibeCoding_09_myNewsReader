/**
 * news_reader_ui - 모던 프리미엄 카드 렌더링, 모달 뷰어 및 사용자 피드백 UI
 */

const NewsUI = (function () {
  // DOM 캐싱
  const elements = {
    newsGrid: document.getElementById('newsGrid'),
    emptyState: document.getElementById('emptyState'),
    loadingSpinner: document.getElementById('loadingSpinner'),
    spinnerText: document.getElementById('spinnerText'),
    endOfFeed: document.getElementById('endOfFeed'),
    scrollSentinel: document.getElementById('scrollSentinel'),
    activeTopicsDisplay: document.getElementById('activeTopicsDisplay'),
    articleCountDisplay: document.getElementById('articleCountDisplay'),
    toastContainer: document.getElementById('toastContainer'),
    currentDateDisplay: document.getElementById('currentDateDisplay'),
    // 모달 엘리먼트
    modalOverlay: document.getElementById('modalOverlay'),
    modalCloseBtn: document.getElementById('modalCloseBtn'),
    modalImage: document.getElementById('modalImage'),
    modalCategoryBadge: document.getElementById('modalCategoryBadge'),
    modalRelativeTime: document.getElementById('modalRelativeTime'),
    modalPublisherAvatar: document.getElementById('modalPublisherAvatar'),
    modalPubInitial: document.getElementById('modalPubInitial'),
    modalSource: document.getElementById('modalSource'),
    modalDate: document.getElementById('modalDate'),
    modalTitle: document.getElementById('modalTitle'),
    modalBody: document.getElementById('modalBody'),
    modalSourceLink: document.getElementById('modalSourceLink')
  };

  // 오늘 날짜 표시 초기화
  (function initDate() {
    if (elements.currentDateDisplay) {
      const now = new Date();
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      elements.currentDateDisplay.textContent = `${now.getFullYear()}. ${now.getMonth() + 1}. ${now.getDate()} (${days[now.getDay()]})`;
    }
  })();

  /**
   * 언론사 첫 글자 추출 (아바타용)
   */
  function getInitial(sourceName) {
    if (!sourceName) return 'N';
    return sourceName.trim().charAt(0).toUpperCase();
  }

  /**
   * 요구사항 3 & 5 충족:
   * 제목, 이미지, '읽기' 버튼이 있는 카드 형태
   * 깔끔한 흰색 배경과 세련된 그림자, 마이크로 인터랙션
   */
  function createCardElement(article, index = 0) {
    const card = document.createElement('article');
    card.className = 'premium-news-card fade-slide-up';
    card.style.animationDelay = `${(index % 10) * 0.05}s`;
    card.setAttribute('data-id', article.id);

    const sourceInitial = getInitial(article.source);
    const faviconHtml = article.sourceIcon 
      ? `<img src="${escapeHtml(article.sourceIcon)}" alt="${escapeHtml(article.source)}" class="source-favicon" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';"><span class="avatar-fallback" style="display:none;">${sourceInitial}</span>`
      : `<span class="avatar-fallback">${sourceInitial}</span>`;

    card.innerHTML = `
      <div class="card-thumb-area">
        <div class="thumb-badges-top">
          <span class="category-pill ${article.badgeClass}">${escapeHtml(article.categoryLabel)}</span>
          <span class="time-pill">${escapeHtml(article.relativeTime || '최신')}</span>
        </div>
        <img 
          src="${escapeHtml(article.imageUrl)}" 
          alt="${escapeHtml(article.title)}" 
          class="card-thumb-img" 
          loading="lazy"
          onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800&auto=format&fit=crop&q=80';"
        >
        <div class="thumb-overlay-gradient"></div>
      </div>

      <div class="card-body-area">
        <div class="card-source-row">
          <div class="source-avatar-wrap">
            ${faviconHtml}
          </div>
          <span class="source-name-text">${escapeHtml(article.source)}</span>
        </div>

        <h3 class="card-headline" title="${escapeHtml(article.title)}">
          ${escapeHtml(article.title)}
        </h3>

        <p class="card-summary">
          ${escapeHtml(article.description)}
        </p>

        <div class="card-action-bar">
          <span class="card-meta-date">${escapeHtml(article.pubDate ? article.pubDate.split(' ')[0] : '')}</span>
          <button type="button" class="btn-read-pill" aria-label="기사 본문 읽기">
            <span>읽기</span>
            <svg class="read-arrow-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </button>
        </div>
      </div>
    `;

    // '읽기' 버튼 클릭 이벤트
    const readBtn = card.querySelector('.btn-read-pill');
    readBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openArticleModal(article);
    });

    // 카드 본체 클릭 시에도 읽기 모달 오픈
    card.addEventListener('click', () => {
      openArticleModal(article);
    });

    return card;
  }

  /**
   * 기사 렌더링 (append가 true면 기존 목록 뒤에 10건 추가)
   */
  function renderArticles(articles, append = false) {
    if (!append) {
      elements.newsGrid.innerHTML = '';
    }

    if (!articles || articles.length === 0) {
      if (!append) {
        showEmptyState(true);
      }
      return;
    }

    showEmptyState(false);
    const fragment = document.createDocumentFragment();

    articles.forEach((art, idx) => {
      const cardEl = createCardElement(art, idx);
      fragment.appendChild(cardEl);
    });

    elements.newsGrid.appendChild(fragment);
    updateCountDisplay();
  }

  /**
   * 총 렌더링된 기사 수 UI 업데이트
   */
  function updateCountDisplay() {
    const totalCount = elements.newsGrid.children.length;
    elements.articleCountDisplay.textContent = `${totalCount}개의 기사 로드됨`;
  }

  /**
   * 활성화된 주제 뱃지 리스트 업데이트
   */
  function updateActiveTopicsDisplay(topicKeys) {
    elements.activeTopicsDisplay.innerHTML = '';
    if (!topicKeys || topicKeys.length === 0) {
      elements.activeTopicsDisplay.innerHTML = '<span class="topic-tag-badge">선택 없음</span>';
      return;
    }

    topicKeys.forEach(k => {
      const conf = CONFIG.TOPICS[k];
      const tag = document.createElement('span');
      tag.className = `topic-tag-badge ${conf ? conf.badgeClass : ''}`;
      tag.textContent = `${conf ? conf.icon : ''} ${conf ? conf.label : k}`;
      elements.activeTopicsDisplay.appendChild(tag);
    });
  }

  /**
   * 기사 본문 모달 열기 (요구사항 3)
   */
  function openArticleModal(article) {
    elements.modalImage.src = article.imageUrl;
    elements.modalImage.alt = article.title;
    elements.modalCategoryBadge.textContent = article.categoryLabel;
    elements.modalCategoryBadge.className = `modal-cat-badge ${article.badgeClass}`;
    elements.modalRelativeTime.textContent = article.relativeTime || '최신';

    // 언론사 파비콘/이니셜
    if (article.sourceIcon) {
      elements.modalPublisherAvatar.innerHTML = `<img src="${escapeHtml(article.sourceIcon)}" alt="${escapeHtml(article.source)}" class="source-favicon">`;
    } else {
      elements.modalPublisherAvatar.innerHTML = `<span class="avatar-fallback">${getInitial(article.source)}</span>`;
    }

    elements.modalSource.textContent = article.source;
    elements.modalDate.textContent = article.pubDate || '발행일 정보 없음';
    elements.modalTitle.textContent = article.title;

    // 본문 문단 분리
    elements.modalBody.innerHTML = '';
    const bodyContent = article.content || article.description || '';
    const paragraphs = bodyContent.split('\n').map(p => p.trim()).filter(p => p.length > 0);

    if (paragraphs.length > 0) {
      paragraphs.forEach(text => {
        const p = document.createElement('p');
        p.textContent = text;
        elements.modalBody.appendChild(p);
      });
    } else {
      const p = document.createElement('p');
      p.textContent = '본문 세부 내용이 제공되지 않는 기사입니다. 아래 원문 기사 보러 가기를 이용하세요.';
      elements.modalBody.appendChild(p);
    }

    elements.modalSourceLink.href = article.url;

    // 표시
    elements.modalOverlay.classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  /**
   * 기사 본문 모달 닫기
   */
  function closeArticleModal() {
    elements.modalOverlay.classList.add('hidden');
    document.body.classList.remove('modal-open');
  }

  /**
   * 로더 스피너 토글
   */
  function showLoading(show, message = '기사 10건을 더 불러오는 중입니다...') {
    if (show) {
      elements.spinnerText.textContent = message;
      elements.loadingSpinner.classList.remove('hidden');
      elements.endOfFeed.classList.add('hidden');
    } else {
      elements.loadingSpinner.classList.add('hidden');
    }
  }

  function showEmptyState(show) {
    if (show) {
      elements.emptyState.classList.remove('hidden');
      elements.newsGrid.classList.add('hidden');
    } else {
      elements.emptyState.classList.add('hidden');
      elements.newsGrid.classList.remove('hidden');
    }
  }

  function showEndOfFeed(show) {
    if (show) {
      elements.endOfFeed.classList.remove('hidden');
    } else {
      elements.endOfFeed.classList.add('hidden');
    }
  }

  /**
   * 모던 플로팅 토스트
   */
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `modern-toast ${type}`;
    
    const icon = type === 'error' ? '⚠️' : type === 'success' ? '✨' : 'ℹ️';
    toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-msg">${escapeHtml(message)}</span>`;

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-leave');
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  return {
    elements,
    renderArticles,
    updateActiveTopicsDisplay,
    openArticleModal,
    closeArticleModal,
    showLoading,
    showEmptyState,
    showEndOfFeed,
    showToast
  };
})();
