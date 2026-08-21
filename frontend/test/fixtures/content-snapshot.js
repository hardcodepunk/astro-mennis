const cloudinaryImage = name =>
  `https://res.cloudinary.com/demo/image/upload/v1/${name}.jpg`
const cloudinaryVideo = (name, extension) =>
  `https://res.cloudinary.com/demo/video/upload/v1/${name}.${extension}`
const sanityPoster = (url, width, height) => ({
  url,
  crop: {top: 0.05, bottom: 0.05, left: 0.05, right: 0.05},
  hotspot: {x: 0.45, y: 0.55, width: 0.4, height: 0.4},
  dimensions: {width, height},
})

export default {
  siteSettings: {
    homeSeoH1: "Fixture home",
    projectsSeoH1: "Fixture projects",
    videoHero: {
      poster: cloudinaryImage("fixture-hero"),
      webm: cloudinaryVideo("fixture-hero", "webm"),
      mp4: cloudinaryVideo("fixture-hero", "mp4"),
      caption: "Fixture hero",
      captionTextScale: 100,
      captionUppercase: false,
    },
    workflowPanel: {
      kicker: "Fixture workflow",
      title: "One stable content snapshot",
      body: "Offline builds without mutable external content.",
      mirrorLayout: false,
    },
  },
  seoSettings: {
    siteUrl: "https://example.test",
    defaultTitle: "Fixture De Mennis",
    titleTemplate: "%s | Fixture De Mennis",
    defaultDescription: "Fixture description for deterministic builds.",
    defaultSocialImage: cloudinaryImage("fixture-social"),
    defaultSocialImageAlt: "Fixture social image",
    brandName: "De Mennis",
    personName: "Fixture Person",
    baseCity: "Gent",
    baseCountry: "Belgium",
    sameAs: ["https://example.test/profile"],
    homeTitle: "Fixture home",
    homeDescription: "Fixture homepage description.",
    homeNoindex: false,
    projectsTitle: "Fixture projects",
    projectsDescription: "Fixture projects description.",
    projectsNoindex: false,
    aboutTitle: "Fixture about",
    aboutDescription: "Fixture about description.",
    aboutNoindex: false,
    contactTitle: "Fixture contact",
    contactDescription: "Fixture contact description.",
    contactNoindex: false,
  },
  contactPage: {
    animatedSentences: ["Fixture sentence one.", "Fixture sentence two."],
    mailSentence: "Send a fixture message.",
    email: "fixture@example.test",
  },
  logoMarquee: {
    logos: [
      {
        name: "Fixture logo",
        alt: "Fixture logo",
        image: {
          url: cloudinaryImage("fixture-logo"),
          dimensions: {width: 640, height: 320},
        },
      },
    ],
  },
  bioWithPreview: {
    heroTitle: "Fixture bio",
    heroTitleTextScale: 100,
    seoH1: "Fixture about heading",
    bio: "A deterministic biography for offline checks.",
    mirrorLayout: false,
    bioTextScale: 100,
    approach: {
      kicker: "Approach",
      title: "Fixture approach",
      body: "Stable inputs produce reproducible output.",
      mirrorLayout: false,
    },
    contactReasons: {
      kicker: "Contact",
      title: "Fixture reasons",
      items: ["A deterministic build", "A focused test"],
      mirrorLayout: false,
    },
  },
  categories: [
    {
      slug: "film",
      title: "Film",
      sortOrder: 1,
      seo: {title: "Fixture film", noindex: false},
    },
    {
      slug: "events",
      title: "Events",
      sortOrder: 2,
      seo: {title: "Fixture events", noindex: true},
    },
  ],
  works: [
    {
      _id: "work-fixture-preview",
      slug: "fixture-preview",
      title: "Fixture Preview",
      category: "Film",
      categorySlug: "film",
      client: "Fixture Client",
      year: "2026",
      publishedAt: "2026-03-03T12:00:00.000Z",
      updatedAt: "2026-03-04T12:00:00.000Z",
      preview: {
        poster: cloudinaryImage("fixture-preview"),
        webm: cloudinaryVideo("fixture-preview", "webm"),
        mp4: cloudinaryVideo("fixture-preview", "mp4"),
      },
      thumbnailAutoplay: true,
      featuredOnHome: true,
      featuredOrder: 2,
      seo: {description: "Fixture preview project.", noindex: false},
      media: {mode: "preview"},
      overviewTitle: "Fixture preview overview",
      body: [
        {
          _key: "preview-block",
          _type: "block",
          style: "normal",
          markDefs: [],
          children: [
            {
              _key: "preview-span",
              _type: "span",
              text: "Fixture Portable Text.",
              marks: [],
            },
          ],
        },
      ],
    },
    {
      _id: "work-fixture-single",
      slug: "fixture-single",
      title: "Fixture Single",
      category: "Film",
      categorySlug: "film",
      client: "Fixture Client",
      year: "2025",
      publishedAt: "2026-02-02T12:00:00.000Z",
      updatedAt: "2026-02-03T12:00:00.000Z",
      preview: {poster: cloudinaryImage("fixture-single")},
      thumbnailAutoplay: false,
      featuredOnHome: true,
      featuredOrder: 1,
      seo: {description: "Fixture single project.", noindex: false},
      media: {
        mode: "single",
        youtubeUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      },
      body: [],
    },
    {
      _id: "work-fixture-slider",
      slug: "fixture-slider",
      title: "Fixture Slider",
      category: "Events",
      categorySlug: "events",
      client: "Fixture Client",
      year: "2024",
      publishedAt: "2026-01-01T12:00:00.000Z",
      updatedAt: "2026-01-02T12:00:00.000Z",
      preview: {
        poster:
          "https://res.cloudinary.com/dkdquifbr/image/upload/v1780481470/Timeline_1_01_00_19_14_fsxgcx.jpg",
      },
      thumbnailAutoplay: false,
      featuredOnHome: false,
      seo: {description: "Fixture slider project.", noindex: true},
      media: {
        mode: "slider",
        reels: [
          {
            _key: "fixture-reel-native",
            youtubeUrl: "https://youtu.be/dQw4w9WgXcQ",
            poster: cloudinaryImage("fixture-slider-legacy-reel"),
          },
          "https://www.youtube.com/shorts/aqz-KE-bpKQ",
        ],
        reelPosters: [
          {
            _key: "fixture-reel-native",
            posterImage: sanityPoster(
              "https://cdn.sanity.io/images/454gxa26/production/44215b5f7e7d20b4e0ad54fa750cce23ca1ea743-2480x3508.png",
              2480,
              3508,
            ),
          },
        ],
      },
      body: [
        {
          _key: "fixture-image",
          _type: "inlineImage",
          alt: "Fixture inline image",
          asset: {
            url: "https://cdn.sanity.io/images/fixture/production/fixture.jpg",
            metadata: {dimensions: {width: 1200, height: 800}},
          },
        },
      ],
    },
    {
      _id: "work-multiple-videos-demo",
      slug: "multiple-videos-demo",
      title: "Multiple Videos Demo",
      category: "Events",
      categorySlug: "events",
      client: "UI Prototype",
      year: "2026",
      publishedAt: "2025-12-01T12:00:00.000Z",
      updatedAt: "2026-08-12T12:00:00.000Z",
      preview: {
        poster:
          "https://res.cloudinary.com/dkdquifbr/image/upload/v1780481470/Timeline_1_01_00_19_14_fsxgcx.jpg",
      },
      thumbnailAutoplay: false,
      featuredOnHome: false,
      seo: {
        description: "Local UI prototype for a project with multiple landscape videos.",
        noindex: true,
      },
      media: {
        mode: "gallery",
        videos: [
          {
            title: "Piston Atelier",
            youtubeUrl: "https://youtu.be/uTGFZtjBpaA",
            posterImage: sanityPoster(
              "https://cdn.sanity.io/images/454gxa26/production/1b38f9bc88421087fa7693104f4127fd40024294-2049x1449.png",
              2049,
              1449,
            ),
          },
          {
            title: "Fonkel Silent Disco",
            youtubeUrl: "https://youtu.be/y3xJKpSCcAk",
            poster:
              "https://res.cloudinary.com/dkdquifbr/image/upload/v1780391165/mini_trailer_01_12_32_15_hhfc70.jpg",
          },
          {
            title: "Alles Kan",
            youtubeUrl: "https://youtu.be/zMtQ7tV7km0",
          },
        ],
      },
      overviewTitle: "One project, multiple films",
      body: [
        {
          _key: "multiple-videos-demo-block",
          _type: "block",
          style: "normal",
          markDefs: [],
          children: [
            {
              _key: "multiple-videos-demo-span",
              _type: "span",
              text: "Use the previous/next controls or swipe to move through the films. Only the video you choose is loaded and played.",
              marks: [],
            },
          ],
        },
      ],
    },
  ],
}
