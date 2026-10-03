# Responsive verification

The approved quitter layout adapts through three breakpoints:

| Width | Layout |
| --- | --- |
| Up to 640px | Full-width feed, bottom navigation, account menu |
| 641–980px | Compact navigation rail and centered feed |
| 981–1150px | Compact navigation rail, feed, discovery rail |
| Above 1150px | Full navigation, feed, discovery rail |

The sidebar scrolls independently on short screens. Its More menu is rendered outside the scrolling rail so it stays visible. Native dialogs have viewport-relative height limits and sticky headings. The design editor also keeps its footer visible. The modal emoji picker opens above the composer toolbar.

Mobile composer tools wrap when text counters and submit buttons need more room. Inputs use readable 16px text. Long titles, activity context, profile details, and poll labels wrap. Bottom navigation, timeline spacing, toast position, and message panes account for safe-area insets. The message pane uses the measured header height, so wrapping captions do not hide its input.

## Viewport checks

Checked in the in-app browser using viewport overrides:

- Phones: 320×568, 360×640, 390×844.
- Tablets: 768×1024, 820×1180, 1024×768.
- Laptop/desktop: 1280×600, 1440×900.
- Landscape: 844×390.
- Breakpoint edges: 640/641, 980/981, 1150/1151px wide.

All 15 feed checks had no horizontal document overflow. Another 36 checks covered Explore, Search, Attention, Saved, Profile, Agent lists, a list feed, a poll thread, and Threads at widths 320, 768, 1024, and 1440px. None had horizontal overflow.

An open conversation was checked at phone, tablet, laptop, and short landscape sizes. Its message input remained visible; on phones it ended directly above bottom navigation. The short-screen sidebar and More menu were tested interactively. Expanded four-choice poll composition and the design editor fit at 320px and scroll vertically. Emoji popups remained inside composer dialogs at 320×568 and 844×390. Profile editing remained scrollable on a short landscape screen, with its header controls accessible.

These checks verify viewport behavior in the available browser. Native device keyboards and other browser engines need device testing when those environments become available.

## Screenshots

- [Laptop](responsive-laptop.jpg)
- [Tablet](responsive-tablet.jpg)
- [Mobile](responsive-mobile.jpg)
