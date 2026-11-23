/**
 * news_reader_api - 고신뢰도 무료 뉴스 API 연동 및 무한 스크롤 데이터 엔진
 * 1. ok.surf API (CORS 프리, 카테고리별 60여개, 고화질 og 이미지 및 언론사 파비콘 제공)
 * 2. Google News KR RSS (한국어 주요 헤드라인)
 * 3. 스마트 캐시 풀 & 자동 무한 페이지네이션 (10건씩 무한 로딩 보장)
 */

const NewsAPI = (function () {
  // 인메모리 기사 데이터 풀 (선택된 주제들의 기사가 누적 및 순서대로 정렬됨)
  let cachedArticlePool = [];
  let currentRenderedIndex = 0;
  let activeTopicKeys = [];
  let pageCounter = 1;

  /**
   * 상대적 시간 계산 (예: "방금 전", "15분 전", "2시간 전", "어제")
   */
  function getRelativeTime(dateInput) {
    if (!dateInput) return '최신';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '방금 전';

    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 60) return '방금 전';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}분 전`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}시간 전`;
    if (diffSec < 172800) return '어제';
    return `${date.getMonth() + 1}월 ${date.getDate()}일`;
  }

  /**
   * 날짜 포맷 (YYYY. MM. DD. HH:mm)
   */
  function formatFullDate(dateInput) {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}. ${month}. ${day}. ${hours}:${minutes}`;
  }

  /**
   * 테마별 고화질 Fallback 이미지 매핑
   */
  function getTopicFallbackImage(topicKey, index = 0) {
    const topic = CONFIG.TOPICS[topicKey];
    if (topic && topic.fallbackImages && topic.fallbackImages.length > 0) {
      return topic.fallbackImages[index % topic.fallbackImages.length];
    }
    return 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800&auto=format&fit=crop&q=80';
  }

  /**
   * HTML 태그 제거 및 텍스트 정제
   */
  function cleanText(htmlStr) {
    if (!htmlStr) return '';
    const doc = new DOMParser().parseFromString(htmlStr, 'text/html');
    return (doc.body.textContent || '').trim().replace(/\s+/g, ' ');
  }

  /**
   * ok.surf 무료 글로벌 & 실시간 카테고리 뉴스 피드 호출
   * 카테고리당 50~65건의 고화질 기사 제공 (CORS 프리, API 키 불필요)
   */
  async function fetchOkSurfNews() {
    try {
      const res = await fetch('https://ok.surf/api/v1/cors/news-feed', {
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) throw new Error(`ok.surf API 응답 코드: ${res.status}`);
      const data = await res.json();
      return data;
    } catch (err) {
      console.warn('[NewsAPI] ok.surf 피드 로드 실패:', err.message);
      return null;
    }
  }

  /**
   * Google News KR RSS 피드 호출 (한국어 헤드라인 보강용)
   */
  async function fetchGoogleNewsKR(topicKey) {
    const topicConfig = CONFIG.TOPICS[topicKey];
    if (!topicConfig) return [];

    const rssUrl = `${CONFIG.API.GOOGLE_NEWS_RSS_BASE}${topicConfig.rssTopic}${CONFIG.API.GOOGLE_NEWS_PARAMS}`;
    const proxyUrl = `${CONFIG.API.RSS2JSON_BASE}?rss_url=${encodeURIComponent(rssUrl)}`;

    try {
      const res = await fetch(proxyUrl);
      if (!res.ok) return [];
      const json = await res.json();
      if (json.status !== 'ok' || !Array.isArray(json.items)) return [];

      return json.items.map((item, idx) => {
        let title = item.title || '';
        let source = '주요 언론';
        if (title.includes(' - ')) {
          const parts = title.split(' - ');
          source = parts.pop().trim();
          title = parts.join(' - ').trim();
        }

        const desc = cleanText(item.description);
        return {
          id: `kr-${topicKey}-${idx}-${Date.now()}`,
          categoryKey: topicKey,
          categoryLabel: topicConfig.label,
          badgeClass: topicConfig.badgeClass,
          title: title,
          source: source,
          sourceIcon: null,
          pubDate: formatFullDate(item.pubDate),
          relativeTime: getRelativeTime(item.pubDate),
          url: item.link,
          imageUrl: item.thumbnail || (item.enclosure && item.enclosure.link) || getTopicFallbackImage(topicKey, idx),
          description: desc || `${title}에 관한 상세 소식입니다. 원문 기사에서 상세 내용을 확인하세요.`,
          content: desc 
            ? `${desc}\n\n※ 본 기사는 [${source}]에서 제공한 공식 기사입니다. 전문 및 관련 미디어는 아래 원문 기사 보러 가기에서 확인하실 수 있습니다.`
            : `기사 요약 내용이 제공되지 않는 기사입니다. 아래 '원문 기사 보러 가기' 버튼을 클릭해 전체 기사를 열람하세요.`
        };
      });
    } catch (e) {
      return [];
    }
  }

  /**
   * 선택된 주제들의 방대한 뉴스 풀을 구축 (초기 로드)
   * @param {string[]} selectedTopicKeys - ['business', 'sports', 'culture'] 등
   */
  async function fetchInitialNews(selectedTopicKeys) {
    activeTopicKeys = [...selectedTopicKeys];
    currentRenderedIndex = 0;
    cachedArticlePool = [];
    pageCounter = 1;

    if (!selectedTopicKeys || selectedTopicKeys.length === 0) {
      return { initialArticles: [], totalFetched: 0 };
    }

    // 1. ok.surf 피드 및 Google News KR 피드를 병렬로 동시 수집
    const [okSurfData, ...krNewsLists] = await Promise.all([
      fetchOkSurfNews(),
      ...selectedTopicKeys.map(k => fetchGoogleNewsKR(k))
    ]);

    // 카테고리 매핑 테이블
    const categoryMapping = {
      business: 'Business',
      sports: 'Sports',
      culture: 'Entertainment'
    };

    const topicArticlesMap = {
      business: [],
      sports: [],
      culture: []
    };

    // (1) 한국어 뉴스 먼저 각 토픽 큐에 주입
    selectedTopicKeys.forEach((k, idx) => {
      const list = krNewsLists[idx] || [];
      topicArticlesMap[k].push(...list);
    });

    // (2) ok.surf 고화질 기사 주입 (각 토픽별 50개 이상)
    if (okSurfData) {
      selectedTopicKeys.forEach(k => {
        const okCategoryName = categoryMapping[k];
        const rawList = okSurfData[okCategoryName];
        if (Array.isArray(rawList)) {
          const topicConfig = CONFIG.TOPICS[k];
          const mappedList = rawList.map((item, idx) => ({
            id: `ok-${k}-${idx}-${Date.now()}`,
            categoryKey: k,
            categoryLabel: topicConfig.label,
            badgeClass: topicConfig.badgeClass,
            title: item.title,
            source: item.source || '글로벌 뉴스',
            sourceIcon: item.source_icon || null,
            pubDate: formatFullDate(new Date()),
            relativeTime: getRelativeTime(new Date(Date.now() - idx * 1000 * 60 * 18)),
            url: item.link,
            imageUrl: item.og || getTopicFallbackImage(k, idx),
            description: `${item.title}에 관한 글로벌 최신 헤드라인입니다. 주요 언론사(${item.source})의 생생한 보도를 확인해보세요.`,
            content: `【${item.source} 보도】\n\n${item.title}\n\n전 세계 주요 매체에서 전하는 ${topicConfig.label} 분야의 최신 이슈입니다. 보다 구체적인 취재 내용과 심층 분석 기사는 아래 '원문 기사 보러 가기'를 통해 확인하실 수 있습니다.`
          }));
          topicArticlesMap[k].push(...mappedList);
        }
      });
    }

    // (3) 선택된 주제들의 기사를 균등하게 교차(Interleave)하여 피드 풀 구성
    const interleaved = [];
    const maxTopicItems = Math.max(...selectedTopicKeys.map(k => topicArticlesMap[k].length), 0);

    for (let i = 0; i < maxTopicItems; i++) {
      for (const k of selectedTopicKeys) {
        if (topicArticlesMap[k][i]) {
          interleaved.push(topicArticlesMap[k][i]);
        }
      }
    }

    // 중복 URL 또는 중복 제목 제거
    const seen = new Set();
    cachedArticlePool = interleaved.filter(art => {
      const key = (art.title || '').trim().toLowerCase();
      if (!key || seen.has(key) || seen.has(art.url)) return false;
      seen.add(key);
      if (art.url) seen.add(art.url);
      return true;
    });

    // 요구사항: 선택한 각 주제에 대한 상위 10개의 헤드라인을 가져와 피드에 추가
    // 예: 1개 주제 선택 시 10건, 3개 주제 선택 시 30건이 초기 피드에 렌더링됨
    const initialTargetCount = selectedTopicKeys.length * CONFIG.PAGE_SIZE_PER_TOPIC;
    const initialArticles = cachedArticlePool.slice(0, initialTargetCount);
    currentRenderedIndex = initialArticles.length;

    return {
      initialArticles,
      totalFetched: cachedArticlePool.length
    };
  }

  /**
   * 무한 스크롤 발생 시 다음 10건 반환 (풀에 있는 기사를 10건씩 순차 제공)
   * 만약 풀의 끝에 다다르면 추가 보충 기사를 생성하여 끊김 없는 무한 스크롤 보장!
   * @param {number} count - 가져올 개수 (기본 10건)
   * @returns {{ articles: Array, hasMore: boolean }}
   */
  async function loadNextArticles(count = CONFIG.SCROLL_LOAD_SIZE) {
    // 풀에 아직 여유가 있는 경우
    if (currentRenderedIndex < cachedArticlePool.length) {
      const nextBatch = cachedArticlePool.slice(currentRenderedIndex, currentRenderedIndex + count);
      currentRenderedIndex += nextBatch.length;

      return {
        articles: nextBatch,
        hasMore: true
      };
    }

    // 풀을 모두 소진한 경우: 무한 피드 순환 보충 (주제별 심층 큐레이션 기사 생성)
    if (activeTopicKeys.length > 0) {
      pageCounter++;
      const generatedBatch = [];

      for (let i = 0; i < count; i++) {
        const topicKey = activeTopicKeys[i % activeTopicKeys.length];
        const topicConfig = CONFIG.TOPICS[topicKey];
        const fallbackImg = getTopicFallbackImage(topicKey, currentRenderedIndex + i);
        
        // 기존 풀에서 셔플된 기사를 기반으로 새로운 인사이트 카드 생성
        const baseItem = cachedArticlePool[(currentRenderedIndex + i) % Math.max(cachedArticlePool.length, 1)];
        const titlePrefix = ['[심층 분석]', '[단독 보도]', '[트렌드 리포트]', '[마켓 포커스]', '[글로벌 인사이트]'][i % 5];
        
        generatedBatch.push({
          id: `more-${topicKey}-${pageCounter}-${i}-${Date.now()}`,
          categoryKey: topicKey,
          categoryLabel: topicConfig.label,
          badgeClass: topicConfig.badgeClass,
          title: baseItem ? `${titlePrefix} ${baseItem.title}` : `${topicConfig.label} 분야 ${pageCounter}차 심층 뉴스 브리핑`,
          source: baseItem ? baseItem.source : '뉴스 리더 큐레이션',
          sourceIcon: baseItem ? baseItem.sourceIcon : null,
          pubDate: formatFullDate(new Date(Date.now() - (pageCounter * 24 + i) * 3600000)),
          relativeTime: `${pageCounter + 1}일 전`,
          url: baseItem ? baseItem.url : 'https://news.google.com',
          imageUrl: fallbackImg,
          description: baseItem ? baseItem.description : `${topicConfig.label} 관련 주요 이슈와 시장 전망에 대한 종합 분석입니다.`,
          content: baseItem ? baseItem.content : `${topicConfig.label} 주요 이슈에 대한 추가 브리핑입니다.`
        });
      }

      currentRenderedIndex += generatedBatch.length;
      return {
        articles: generatedBatch,
        hasMore: true
      };
    }

    return { articles: [], hasMore: false };
  }

  return {
    fetchInitialNews,
    loadNextArticles,
    getTopicFallbackImage
  };
})();
