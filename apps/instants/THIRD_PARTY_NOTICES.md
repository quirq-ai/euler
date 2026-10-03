# Third-party notices and asset scope

The root [MIT license](LICENSE) covers original project code and documentation. It does not replace the licenses of dependencies, vendored materials, or external assets.

## Vendored code

| Material                            | Origin                                                                      | License and notice                                                                      |
| ----------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `build/sites-vite-plugin.ts`        | `@openai/sites-vite-plugin` 0.2.0; provenance retained in the source header | MIT, Copyright (c) 2026 OpenAI; [full notice](build/sites-vite-plugin.LICENSE)          |
| `vendor/shadcn-tailwind-4.13.0.css` | shadcn stylesheet                                                           | MIT, Copyright (c) 2023 shadcn; [full notice](vendor/shadcn-tailwind-4.13.0.LICENSE.md) |

Preserve these notices when redistributing the corresponding materials. Packages installed from `package-lock.json` retain their own licenses; consult the license files shipped with each package. This file is not an exhaustive dependency license inventory.

## Photography

The sample data references photographs served from Unsplash. The photographs are not original Instants code and are not covered by the project's MIT license. This also applies when they appear in screenshots or demonstration recordings.

One featured image is [Mike Swigunski's Italian coastline photograph](https://unsplash.com/photos/houses-on-mountain-near-sea-under-blue-sky-during-daytime-HXtjr6tJGv8). Other image URLs are listed in `data/mock.json`. Review the [Unsplash license](https://unsplash.com/license) and the relevant source assets before redistributing or substituting imagery. Replace remote URLs with assets you have the right to use when creating your own distribution.

Team accounts, work descriptions, and conversations are illustrative sample content for `xo_builders` and `quirq_ai`. The photographs are sample imagery, not assertions about real people, their roles, or their participation in those conversations.

## Fonts

The default brand configuration requests Manrope through Google Fonts. Font files are served externally and remain subject to their own license. This repository's MIT license does not relicense those font files. Change `fontStylesheet` and the font settings in `config/brand.json` to supply another licensed font or use local/system fonts.

## Names and logos

The Instants and Quirq names, wordmarks, and Quirq logo asset are branding materials, excluded from the project's MIT license. No trademark rights are granted by the code license. Replace the branding in `config/brand.json` and the associated assets for your own branded derivative.

Instagram and Meta are referenced only to describe the familiar UI context. This is an independent prototype and has no affiliation with or endorsement from either company.
