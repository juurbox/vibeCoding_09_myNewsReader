/**
 * news_reader_config - 주제 설정, API 엔드포인트 및 테마별 Fallback 이미지
 */
const CONFIG = {
  // 사용 가능한 주제 정의
  TOPICS: {
    business: {
      id: 'business',
      label: '비즈니스',
      icon: '💼',
      badgeClass: 'business',
      rssTopic: 'BUSINESS',
      gnewsCategory: 'business',
      fallbackImages: [
        'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800&auto=format&fit=crop&q=80'
      ]
    },
    sports: {
      id: 'sports',
      label: '스포츠',
      icon: '⚽',
      badgeClass: 'sports',
      rssTopic: 'SPORTS',
      gnewsCategory: 'sports',
      fallbackImages: [
        'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&auto=format&fit=crop&q=80'
      ]
    },
    culture: {
      id: 'culture',
      label: '문화',
      icon: '🎨',
      badgeClass: 'culture',
      rssTopic: 'ENTERTAINMENT',
      gnewsCategory: 'entertainment',
      fallbackImages: [
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1499364615650-ec38552f4f34?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800&auto=format&fit=crop&q=80'
      ]
    }
  },

  // API 엔드포인트 설정
  API: {
    // 키 없이 즉시 브라우저에서 동작 가능한 무료 RSS to JSON 프록시
    RSS2JSON_BASE: 'https://api.rss2json.com/v1/api.json',
    GOOGLE_NEWS_RSS_BASE: 'https://news.google.com/rss/headlines/section/topic/',
    GOOGLE_NEWS_PARAMS: '?hl=ko&gl=KR&ceid=KR:ko',

    // GNews API (선택적)
    GNEWS_BASE: 'https://gnews.io/api/v4/top-headlines',
    DEFAULT_PROVIDER: 'rss' // 'rss' or 'gnews'
  },

  // 로컬 스토리지 키
  STORAGE_KEYS: {
    API_PROVIDER: 'news_reader_provider',
    GNEWS_KEY: 'news_reader_gnews_key',
    SAVED_TOPICS: 'news_reader_topics'
  },

  // 페이징 설정
  PAGE_SIZE_PER_TOPIC: 10,  // 초기 요청 시 각 주제당 10개
  SCROLL_LOAD_SIZE: 10     // 무한 스크롤 시 10건씩 추가
};
