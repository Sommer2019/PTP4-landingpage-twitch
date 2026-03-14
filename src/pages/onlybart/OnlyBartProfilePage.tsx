import React from 'react'
import { useObSprites } from '../../hooks/useObSprites'
import '../../styles/onlybart/ob-style.css'
import '../../styles/onlybart/ob-extracted-styles.css'
import '../../styles/onlybart/ob-square-images.css'

export type ObTab = 'posts' | 'media' | 'photos' | 'videos'

export default function OnlyBartProfilePage({ tab }: { tab: ObTab }) {
  useObSprites()

  const isGallery = tab !== 'posts'
  const isMedia   = tab === 'media'
  const isPhotos  = tab === 'photos'
  const isVideos  = tab === 'videos'

  return (
    <div className="m-ua-windows">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 188" style={{"position": "absolute", "width": "0", "height": "0", "opacity": "0"}}><clipPath clipPathUnits="objectBoundingBox" id="hexagon-clippath" transform="scale(0.005 0.005319148936170213)"><path d="M193.248 69.51C185.95 54.1634 177.44 39.4234 167.798 25.43L164.688 20.96C160.859 15.4049 155.841 10.7724 149.998 7.3994C144.155 4.02636 137.633 1.99743 130.908 1.46004L125.448 1.02004C108.508 -0.340012 91.4873 -0.340012 74.5479 1.02004L69.0879 1.46004C62.3625 1.99743 55.8413 4.02636 49.9981 7.3994C44.155 10.7724 39.1367 15.4049 35.3079 20.96L32.1979 25.47C22.5561 39.4634 14.0458 54.2034 6.74789 69.55L4.39789 74.49C1.50233 80.5829 0 87.2441 0 93.99C0 100.736 1.50233 107.397 4.39789 113.49L6.74789 118.43C14.0458 133.777 22.5561 148.517 32.1979 162.51L35.3079 167.02C39.1367 172.575 44.155 177.208 49.9981 180.581C55.8413 183.954 62.3625 185.983 69.0879 186.52L74.5479 186.96C91.4873 188.32 108.508 188.32 125.448 186.96L130.908 186.52C137.638 185.976 144.163 183.938 150.006 180.554C155.85 177.17 160.865 172.526 164.688 166.96L167.798 162.45C177.44 148.457 185.95 133.717 193.248 118.37L195.598 113.43C198.493 107.337 199.996 100.676 199.996 93.93C199.996 87.1841 198.493 80.5229 195.598 74.43L193.248 69.51Z"></path></clipPath></svg>
      <div id="app" className="main-wrapper">
      <div className="container m-main-container m-right-sidebar"><header className="l-header"><nav data-at-attr="header_menu" className="l-header__menu m-native-custom-scrollbar m-scrollbar-y m-invisible-scrollbar"><button type="button" className="l-header__menu__item m-avatar-item"><span className="l-header__menu__item__icon"><span className="g-avatar m-reset-wcag-link-focus m-guest m-w36">
      <div className="g-avatar__placeholder"><svg className="b-default-avatar g-icon" data-icon-name="icon-profile" aria-hidden="true"><use href="#icon-profile"></use></svg></div>
      </span></span></button><a href="/" className="m-reset-wcag-link-focus l-header__menu__item m-size-lg-hover m-with-round-hover m-width-fluid-hover m-home" data-name=""><span className="l-header__menu__item__icon"><svg className="m-nav-icon g-icon" data-icon-name="icon-home" aria-hidden="true"><use href="#icon-home"></use></svg></span><span className="l-header__menu__item__text"> Start </span></a><button type="button" className="l-header__menu__item m-size-lg-hover m-with-round-hover m-width-fluid-hover"><span className="l-header__menu__item__icon"><svg className="m-nav-icon g-icon" data-icon-name="icon-menu-more" aria-hidden="true"><use href="#icon-menu-more"></use></svg></span><span className="l-header__menu__item__text"> Mehr </span></button></nav>
      <div className="l-sidebar">
      <div className="l-sidebar__wrapper-close"><button type="button" data-at-attr="close_btn" tabIndex={-1} className="l-sidebar__btn-close m-with-round-hover g-btn m-icon m-icon-only m-gray m-sm-size"><svg data-icon-name="icon-close" aria-hidden="true" className="g-icon"><use href="#icon-close"></use></svg></button></div>

      <div tabIndex={-1} className="l-sidebar__inner-overlay"></div>

      <div tabIndex={-1} className="l-sidebar__inner m-native-custom-scrollbar m-scrollbar-y m-invisible-scrollbar">
      <div data-name="Profile" tabIndex={-1} className="l-sidebar__avatar m-reset-wcag-link-focus"><span className="g-avatar m-reset-wcag-link-focus m-guest online_status_class m-w50">
      <div className="g-avatar__placeholder"><svg className="b-default-avatar g-icon" data-icon-name="icon-profile" aria-hidden="true"><use href="#icon-profile"></use></svg></div>
      </span></div>
      <hr className="l-sidebar__menu__divider"/>
      <div className="l-sidebar__menu"><a href="https://hd1920x1080.de/ob/help" className="l-sidebar__menu__item m-break-word m-support m-reset-wcag-link-focus" data-name="FAQ" data-at-attr="FAQ" tabIndex={-1}><svg className="l-sidebar__menu__icon g-icon" data-icon-name="icon-support" aria-hidden="true"><use href="#icon-support"></use></svg><span className="l-sidebar__menu__text"> Hilfe und Support </span></a><button type="button" data-name="SwitchTheme" data-at-attr="theme_btn" tabIndex={-1} className="l-sidebar__menu__item m-break-word m-theme-switch"><svg className="l-sidebar__menu__icon g-icon" data-icon-name="icon-theme-dark" aria-hidden="true"><use href="#icon-theme-dark"></use></svg><span className="l-sidebar__switch-mode__label">Dunkler Modus</span></button>
      <div data-at-attr="lang_dropdown" className="l-sidebar__menu__item m-lang-item m-break-word">
      <div className="dropdown b-dropdown m-row dropright position-static btn-group" id="__BVID__38"><button tabIndex={-1} aria-haspopup="menu" aria-expanded="false" type="button" className="btn dropdown-toggle btn-secondary" id="__BVID__38__BV_toggle_"><span className="m-globe"><svg className="l-sidebar__menu__icon g-icon" data-icon-name="icon-language" aria-hidden="true"><use href="#icon-language"></use></svg></span><span className="b-lang-text g-text-ellipsis"> German </span><span className="b-icon-arrow"><svg className="g-icon" data-icon-name="icon-arrow-down" aria-hidden="true"><use href="#icon-arrow-down"></use></svg></span></button><ul role="menu" tabIndex={-1} className="dropdown-menu m-not-fixed-dropdown m-lang-switcher pt-0 pb-0" aria-labelledby="__BVID__38__BV_toggle_"></ul></div>
      </div>
      <hr className="l-sidebar__menu__divider"/><a href="https://hd1920x1080.de/ob/" className="l-sidebar__menu__item m-reset-wcag-link-focus" tabIndex={-1}><svg className="l-sidebar__menu__icon g-icon" data-icon-name="icon-profile" aria-hidden="true"><use href="#icon-profile"></use></svg><span className="l-sidebar__menu__text"> Anmelden </span></a></div>
      </div>

      <div className="l-sidebar__overlay"></div>
      </div>
      </header><main id="content" tabIndex={-1}>
      <div className="l-wrapper m-guest">
      <div className="l-wrapper__holder-content">
      <div className="l-wrapper__content">
      <div className="b-compact-header g-sides-gaps js-compact-sticky-header">
      <div className="b-compact-header__wrapper d-flex align-items-center flex-wrap g-position-relative g-negative-r-gap"><button className="g-page__header__btn g-btn m-with-round-hover m-icon m-icon-only m-sm-size m-white m-light"><svg data-icon-name="icon-back" aria-hidden="true" className="g-icon"><use href="#icon-back"></use></svg></button>
      <div className="b-compact-header__user mw-0 flex-fill-1">
      <div className="b-username-row m-gap-clear">
      <div className="b-username">
      <div className="g-user-name m-verified m-lg-size"> HD1920x1080 <svg className="m-verified g-icon" data-icon-name="icon-verified" aria-hidden="true"><use href="#icon-verified"></use></svg></div>
      </div>
      </div>

      <div className="b-profile-status mw-100 m-online">
      <div className="b-profile-status__states g-text-ellipsis"> Jetzt verfügbar </div>
      </div>

      <div className="b-profile__sections d-flex align-items-center">
      <div className="b-dragscroll m-native-custom-scrollbar m-scrollbar-x m-invisible-scrollbar m-scroll-behavior m-reset-overscroll"><button type="button" className="b-profile__sections__item b-dot-item g-position-relative d-inline-flex align-items-center g-md-text has-tooltip" data-original-title="null" aria-label="Fotos"><span className="b-profile__sections__link d-flex align-items-center"><svg className="m-icon-sm g-icon" data-icon-name="icon-image" aria-hidden="true"><use href="#icon-image"></use></svg><span className="b-profile__sections__count g-semibold"> 25 </span></span></button><button type="button" className="b-profile__sections__item b-dot-item g-position-relative d-inline-flex align-items-center g-md-text has-tooltip" data-original-title="null" aria-label="Videos"><span className="b-profile__sections__link d-flex align-items-center"><svg className="m-icon-sm g-icon" data-icon-name="icon-video" aria-hidden="true"><use href="#icon-video"></use></svg><span className="b-profile__sections__count g-semibold">2</span></span></button>
      <div className="b-profile__sections__item b-dot-item g-position-relative d-inline-flex align-items-center g-md-text"><span tabIndex={0} className="b-profile__sections__link m-likes m-no-hover d-flex align-items-center has-tooltip" data-original-title="null" aria-label="„Gefällt mir“-Angaben"><svg className="m-icon-sm g-icon" data-icon-name="icon-like" aria-hidden="true"><use href="#icon-like"></use></svg><span className="b-profile__sections__count g-semibold">694</span></span></div>
      </div>
      </div>
      </div>

      <div className="b-group-profile-btns b-btns-group d-flex"></div>
      </div>
      </div>

      <div className="l-profile-container">
      <div className="l-profile-page">
      <div className="b-profile__header m-shadow-top"><img src="/img/OB/Banner.webp" alt="HD1920x1080" loading="lazy" className="b-profile__header__cover-img"/></div>

      <div className="b-profile__header__user g-sides-gaps">
      <div className="b-profile__user d-flex align-items-start"><a href={tab === 'posts' ? '.' : '/onlybart/posts'} className="g-avatar m-reset-wcag-link-focus m-guest online_status_class online m-w100 m-reset-wcag-link-focus">
      <div className="g-avatar__img-wrapper"><img src="/img/logos/HDProfile.webp" alt="HD1920x1080" loading="lazy" fetchPriority="auto"/></div>
      </a>
      <div className="b-group-profile-btns d-flex justify-content-end align-content-end ml-auto b-btns-group"><button type="button" className="g-btn m-rounded m-border m-icon m-icon-only m-colored has-tooltip" data-original-title="null" aria-label="Link zum Profil kopieren"><svg data-icon-name="icon-share" aria-hidden="true" className="g-icon"><use href="#icon-share"></use></svg></button></div>

      <div className="b-profile__names mw-0 w-100 mw-100">
      <div className="b-username-row m-gap-lg">
      <div className="b-username">
      <div className="g-user-name m-verified m-lg-size"> HD1920x1080 <svg className="m-verified g-icon" data-icon-name="icon-verified" aria-hidden="true"><use href="#icon-verified"></use></svg></div>
      </div>
      </div>

      <div className="b-username-row">
      <div className="g-user-realname__wrapper m-nowrap-text">
      <div className="g-user-username"> @hd1920x1080 </div>
      </div>

      <div className="b-profile-status mw-100 m-separator g-nowrap d-flex align-items-center justify-content-start">
      <div className="b-profile-status__states g-text-ellipsis"> Jetzt verfügbar </div>
      </div>
      </div>
      </div>
      </div>

      <div className="b-profile__content">
      <div className="b-user-info m-mb-sm">
      <div className="b-user-info__content">
      <div className="g-truncated-text m-break-word" style={{"maxHeight": "initial", "--mask-size": "80px"} as React.CSSProperties}>
      <div className="b-user-info__text m-break-word"><p>Hey, ich bin Stefan. Sei nicht schüchtern. Hier gibts nur Bart 🧔🏻‍♂️. Ganz viel Bart - in FullHD</p>
      </div>
      <p className="b-user-info__detail m-break-word m-markdown"><svg className="m-initial-icon m-icon-extra-sm g-icon" data-icon-name="icon-location" aria-hidden="true"><use href="#icon-location"></use></svg><span>Marktredwitz</span></p>
      </div>
      </div>
      </div>

      <div className="stories-list g-negative-sides-gaps"></div>
      </div>
      </div>

      <div className="b-profile-section-btns">
      <div className="list-offers b-with-over-separator m-offer-bottom-gap-reset m-main-details mb-0">
      <div className="b-offer-wrapper m-reset-mb m-start-campaign">
      <div className="b-section-title m-row g-text-uppercase g-gray-text"> Abonnement </div>

      <div className="b-offer-join"><a href="https://www.twitch.tv/hd1920x1080">
      <div role="button" tabIndex={0} className="m-fluid-width m-rounded m-flex m-space-between m-lg g-btn"><span className="b-btn-text">Abonnieren</span><span className="b-btn-text">kostenlos</span></div>
      </a>

      </div>
      </div>
      </div>
      </div>

      {/* ── Top tab nav: Beiträge | Medien ── */}
      <div className="b-tabs__nav m-tabs-default m-flex-width m-size-md mb-0 js-tabs-switchers m-over-separator m-nv"><ul className="b-dragscroll m-native-custom-scrollbar m-scrollbar-x m-invisible-scrollbar b-tabs__nav__list m-scroll-behavior m-reset-overscroll">
        <li className="b-tabs__nav__item">
          <a href={isGallery ? '/onlybart/posts' : '.'} aria-current={!isGallery ? 'page' : undefined} className={`b-tabs__nav__link m-reset-wcag-link-focus router-link-active m-with-rectangle-hover m-tb-sm${!isGallery ? ' m-current' : ''}`} id="profilePostTab" tabIndex={0} data-saveprevquery="true"><span className="b-tabs__nav__text"> 1 Beitrag </span></a>
        </li>
        <li className="b-tabs__nav__item">
          <a href={isGallery ? '.' : '/onlybart/media'} aria-current={isGallery ? 'page' : undefined} className={`b-tabs__nav__link m-reset-wcag-link-focus router-link-active m-with-rectangle-hover m-tb-sm${isGallery ? ' m-current' : ''}`} id="m-with-rectangle-hover-m-tb-sm,[object-Object]/hd1920x1080/media27-Medien" tabIndex={0} data-saveprevquery="true"><span className="b-tabs__nav__text"> 27 Medien </span></a>
        </li>
      </ul></div>
      </div>
      </div>

      <div className="g-sides-gaps">
      {/* ── Content filter bar ── */}
      <div className={`b-content-filter-wrapper${isGallery ? ' m-grid-mode' : ''}`}>
      <div className="b-content-filter d-flex flex-row align-items-center flex-wrap g-position-relative"><h2 className="b-content-filter__title g-text-ellipsis g-text-uppercase g-semibold flex-fill-1">Kürzlich</h2>
      <div className="b-content-filter__group-btns b-btns-group d-inline-flex flex-row align-items-center justify-content-end">
      <div className="b-content-filter__btn"><button type="button" className="g-btn m-gray m-with-round-hover m-icon m-icon-only m-default-color m-sm-size"><svg className="m-default-size g-icon" data-icon-name="icon-search" aria-hidden="true"><use href="#icon-search"></use></svg></button></div>

      <div className="b-content-filter__btn">
        {isGallery ? (
          <button className="g-btn m-icon m-icon-only m-gray m-sm-size m-with-round-hover m-icon-size-lg has-tooltip" data-original-title="null" aria-label="Vollständige Ansicht"><svg data-icon-name="icon-view-full" aria-hidden="true" className="g-icon"><use href="#icon-view-full"></use></svg></button>
        ) : (
          <button className="g-btn m-icon m-icon-only m-gray m-sm-size m-with-round-hover m-icon-size-lg has-tooltip" data-original-title="null" aria-label="Kompakte Ansicht"><svg data-icon-name="icon-view-grid" aria-hidden="true" className="g-icon"><use href="#icon-view-grid"></use></svg></button>
        )}
      </div>

      <div className="b-content-filter__btn">
      <div className="dropdown b-dropdown position-static btn-group has-tooltip" data-original-title="null" aria-label="Sortieren" id="__BVID__88"><button aria-haspopup="menu" aria-expanded="false" type="button" className="btn dropdown-toggle btn-secondary g-btn m-gray m-with-round-hover m-icon m-icon-only m-sm-size" id="__BVID__88__BV_toggle_"><svg data-icon-name="icon-sort" aria-hidden="true" className="g-icon"><use href="#icon-sort"></use></svg></button><ul role="menu" tabIndex={-1} className="dropdown-menu dropdown-menu-right" aria-labelledby="__BVID__88__BV_toggle_"></ul></div>
      </div>
      </div>
      </div>
      </div>

      {/* ── Gallery sub-tab nav (Alle / Fotos / Videos) ── */}
      {isGallery && (
        <div className="b-tabs__nav m-nv m-tab-rounded m-single-current mb-0"><ul className="b-dragscroll m-native-custom-scrollbar m-scrollbar-x m-invisible-scrollbar b-tabs__nav__list m-scroll-behavior m-reset-overscroll m-gaps-inside m-gaps-outside">
          <li className="b-tabs__nav__item">
            <a href={isMedia ? '.' : '/onlybart/media'} id="/hd1920x1080/mediaAlle-27" tabIndex={isMedia ? -1 : 0} className={`b-tabs__nav__link m-reset-wcag-link-focus${isMedia ? ' m-current m-no-pointer' : ''}`}><span className="b-tabs__nav__text"> Alle 27 </span></a>
          </li>
          <li className="b-tabs__nav__item">
            <a href={isPhotos ? '.' : '/onlybart/photos'} id="/hd1920x1080/photosFoto-25" tabIndex={isPhotos ? -1 : 0} className={`b-tabs__nav__link m-reset-wcag-link-focus${isPhotos ? ' m-current m-no-pointer' : ''}`}><span className="b-tabs__nav__text"> Foto 25 </span></a>
          </li>
          <li className="b-tabs__nav__item">
            <a href={isVideos ? '.' : '/onlybart/videos'} id="/hd1920x1080/videosVideo-2" tabIndex={isVideos ? -1 : 0} className={`b-tabs__nav__link m-reset-wcag-link-focus${isVideos ? ' m-current m-no-pointer' : ''}`}><span className="b-tabs__nav__text"> Video 2 </span></a>
          </li>
        </ul></div>
      )}

      {/* ── Per-tab content ── */}
      {tab === 'posts' && (
        <>
        <div className="user_posts">
        <div className="g-page-content__body">
        <div className="vue-recycle-scroller g-negative-sides-gaps ready page-mode direction-vertical" data-buffer="768" data-page-mode="">
        <div className="vue-recycle-scroller__item-wrapper" style={{"minHeight": "970px"}}>
        <div className="vue-recycle-scroller__item-view" style={{"transform": "translateY(0px)"}}>
        <div className="dynamic-scroller-item g-sides-gaps">
        <div className="b-post__wrapper">
        <div className="b-post m-pinned is-not-post-page" id="postId_2083105027" data-at-attr="user_post">
        <div className="b-post__header m-w50"><span className="b-post__avatar"><a href="." className="g-avatar m-reset-wcag-link-focus m-reset-wcag-link-focus m-guest online_status_class online m-w50 m-reset-wcag-link-focus">
        <div className="g-avatar__img-wrapper"><img src="/img/logos/HDProfile.webp" alt="HD1920x1080" loading="lazy" fetchPriority="auto"/></div>
        </a></span>
        <div className="b-username-row m-gap-lg"><a data-at-attr="post_author_name" href="." className="b-username">
        <div className="g-user-name m-verified m-md-size"> HD1920x1080 <svg className="m-verified g-icon" data-icon-name="icon-verified" aria-hidden="true"><use href="#icon-verified"></use></svg></div>
        </a>
        <div className="b-post__profile-details"><a className="b-post__date"><span title="01 Jan., 0:42"> 01 Jan., 2026 </span></a>
        <div className="dropdown b-dropdown b-post__tools__more m-not-width-limit m-size-lg m-center position-static btn-group has-tooltip" data-original-title="null" aria-label="Mehr" id="__BVID__308"><button aria-haspopup="menu" aria-expanded="false" type="button" className="btn dropdown-toggle btn-link m-post-btn m-gray" id="__BVID__308__BV_toggle_"><svg data-icon-name="icon-more" aria-hidden="true" className="g-icon"><use href="#icon-more"></use></svg></button><ul role="menu" tabIndex={-1} className="dropdown-menu" aria-labelledby="__BVID__308__BV_toggle_"></ul></div>
        </div>
        </div>

        <div className="b-username-row">
        <div className="g-user-realname__wrapper m-nowrap-text">
        <div className="g-user-username">@hd1920x1080</div>
        </div>

        <div className="b-post__profile-details">
        <div className="b-post__pinned has-tooltip" data-original-title="null" aria-label="Anhefteter Pfosten"><svg data-icon-name="icon-pin-on" aria-hidden="true" className="g-icon"><use href="#icon-pin-on"></use></svg></div>
        </div>
        </div>
        </div>

        <div className="b-post__content js-post__content m-type-post m-post-has-media m-post-has-text">
        <div className="b-post__text m-break-word">
        <div className="b-post__text-el m-possible-markdown">
        <div>
        <div className="g-truncated-text m-break-word" style={{"maxHeight": "initial", "--mask-size": "80px"} as React.CSSProperties}>
        <div><p>Bärte auf dem Klo 🚽 😉 Heute mal wieder nach einer guten Runde HotNuts, Sandwiches und Center Shocks 😍 Falls ihr mir auch was gutes tun wollt😉: <br/>
        <a href="/streamelements" target="_blank" rel="noreferer noopener">https://hd1920x1080.de/StreamElements</a></p>
        </div>
        </div>
        </div>
        </div>
        </div>
        <img src="/img/OB/HDKlo.webp" alt="HDKlo" style={{"maxWidth": "100%", "height": "auto"}}/></div>

        <div className="b-post__tools">
        <div className="b-post__tools__item m-first"><button type="button" disabled className="b-post__tools__btn set-favorite-btn g-btn m-rounded m-icon m-icon-only m-sm-size m-with-round-hover m-gray has-tooltip" data-original-title="null" aria-label="Gefällt mir"><svg className="g-icon" data-icon-name="icon-like" aria-hidden="true"><use href="#icon-like"></use></svg></button></div>

        <div className="b-post__tools__item"><button type="button" disabled className="b-post__tools__btn send-comment-btn g-btn m-rounded m-icon m-icon-only m-sm-size m-with-round-hover m-gray"><svg data-icon-name="icon-comment" aria-hidden="true" className="g-icon"><use href="#icon-comment"></use></svg></button></div>

        <div className="b-post__tools__item m-last">
        <div className="b-dropdown-wrapper m-dropdown-v2 b-post__tools__more m-not-width-limit m-size-lg m-center"><button type="button" disabled role="button" aria-haspopup="true" aria-expanded="false" className="btn dropdown-toggle m-with-round-hover"><svg data-icon-name="icon-bookmark" aria-hidden="true" className="g-icon"><use href="#icon-bookmark"></use></svg></button>
        <div className="v-menu"></div>
        </div>
        </div>
        </div>

        <div className="b-summary-list d-flex flex-wrap g-position-relative">
        <div className="b-dragscroll m-native-custom-scrollbar m-scrollbar-x m-invisible-scrollbar m-gaps-inside m-gaps-outside m-scroll-behavior m-reset-overscroll"><a href="https://hd1920x1080.de/ob/2083105027/hd1920x1080/likes" tabIndex={-1} className="b-dot-item m-dot-bold m-lowercase g-md-text m-default-font-weight d-inline-block m-no-pointer"><span>65</span> Likes</a></div>
        </div>
        </div>
        </div>
        </div>
        </div>
        </div>
        </div>
        </div>
        </div>

        <div className="vue-recycle-scroller__item-view" style={{"transform": "translateY(-9999px)"}}>
        <div tabIndex={-1} className="resize-observer"></div>
        </div>

        <div className="infinite-loading-container">
        <div className="infinite-status-prompt" style={{"display": "none"}}>
        <div className="b-posts_preloader m-pb-16 m-gray-color"><svg data-icon-name="icon-loading" aria-hidden="true" className="g-icon"><use href="#icon-loading"></use></svg></div>
        </div>
        <div className="infinite-status-prompt" style={{"display": "none"}}><div></div></div>
        <div className="infinite-status-prompt" style={{"display": "none"}}><div></div></div>
        <div className="infinite-status-prompt" style={{"color": "rgb(102, 102, 102)", "fontSize": "14px", "padding": "10px 0px", "display": "none"}}>
                Opps, something went wrong :(
                <br/><a href="mailto:admin@hd1920x1080.de?subject=OnlyBart%20Anfrage" className="contact_button m-reset-wcag-link-focus visible-lg has-tooltip" data-original-title="null" aria-label="Hilfe &amp; Support"><svg data-icon-name="icon-support" aria-hidden="true" className="g-icon"><use href="#icon-support"></use></svg></a>
        <div data-at-modals-host="" className="modals-host"></div>
        <div aria-hidden="true" className="safari-page-scroll-hack"><input id="safari-page-scroll-hack" type="text" tabIndex={-1}/></div>
        </div>
        </div>
        </>
      )}

      {tab === 'videos' && (
        <div className="user_posts">
        <div className="g-page-content__body">
        <div className="vue-recycle-scroller g-negative-sides-gaps ready page-mode direction-vertical b-photos b-photos-reduced-outline" data-buffer="768" data-page-mode="">
        <div className="vue-recycle-scroller__item-wrapper" style={{"minHeight": "201px"}}>
        <div className="vue-recycle-scroller__item-view" style={{"transform": "translateY(0px)"}}>
        <div className="dynamic-scroller-item"><a data-id="1986192924" data-at-attr="photo_item" href="https://www.twitch.tv/hd1920x1080/clip/FuriousViscousDinosaurTBTacoRight-LWx07dviaIvdHshD" className="m-reset-wcag-link-focus m-square m-video-item"><img src="/img/OB/festlicherBart.png" alt="festlicher Bart" style={{"width": "100%", "height": "auto"}}/></a><a data-id="1986132393" data-at-attr="photo_item" className="b-photos__item m-reset-wcag-link-focus m-square m-video-item">
        <div className="b-post__unknown m-default-bg">
        <div className="b-post__unknown__icon m-grid-position"><svg className="g-icon" data-icon-name="icon-locked" aria-hidden="true"><use href="#icon-locked"></use></svg>
        <div className="b-post__unknown__price"></div>
        </div>
        <div className="b-subscribe-block m-inside-grid">
        <div className="content-icons"><ul className="b-purchase__list g-text-ellipsis"><li className="b-purchase__list-item"><svg className="m-icon-extra-sm m-aligned-top g-icon" data-icon-name="icon-video" aria-hidden="true"><use href="#icon-video"></use></svg><span className="b-purchase__list-item__count"> 0:03 </span></li></ul></div>
        <span className="b-btn-purchase-post"></span></div>
        </div>
        </a></div>
        </div>
        </div>

        <div tabIndex={-1} className="resize-observer"></div>
        </div>
        </div>
        </div>
      )}

      {tab === 'photos' && (
        <div className="user_posts">
        <div className="g-page-content__body">
        <div className="vue-recycle-scroller g-negative-sides-gaps ready page-mode direction-vertical b-photos b-photos-reduced-outline" data-buffer="768" data-page-mode="">
        <div className="vue-recycle-scroller__item-wrapper" style={{"minHeight": "1735px"}}>
        <div className="vue-recycle-scroller__item-view" style={{"transform": "translateY(0px)"}}>
        <div className="dynamic-scroller-item"><a data-id="1986192924" data-at-attr="photo_item" className="m-reset-wcag-link-focus m-square m-video-item"><img src="/img/OB/ZungenBart.webp" alt="Zungen-Bart" style={{"width": "100%", "height": "auto"}}/></a><a data-id="2082464181" data-at-attr="photo_item" className="b-photos__item m-reset-wcag-link-focus m-square">
        <div className="b-post__unknown m-default-bg">
        <div className="b-post__unknown__icon m-grid-position"><svg className="g-icon" data-icon-name="icon-locked" aria-hidden="true"><use href="#icon-locked"></use></svg>
        <div className="b-post__unknown__price"></div>
        </div>
        <div className="b-subscribe-block m-inside-grid">
        <div className="content-icons"><ul className="b-purchase__list g-text-ellipsis"><li className="b-purchase__list-item"><svg className="m-icon-extra-sm m-aligned-top g-icon" data-icon-name="icon-media" aria-hidden="true"><use href="#icon-media"></use></svg><span className="b-purchase__list-item__count"> 1 </span></li></ul></div>
        <span className="b-btn-purchase-post"></span></div>
        </div>
        </a><a data-id="2082448600" data-at-attr="photo_item" className="b-photos__item m-reset-wcag-link-focus m-square">
        <div className="b-post__unknown m-default-bg">
        <div className="b-post__unknown__icon m-grid-position"><svg className="g-icon" data-icon-name="icon-locked" aria-hidden="true"><use href="#icon-locked"></use></svg>
        <div className="b-post__unknown__price"></div>
        </div>
        <div className="b-subscribe-block m-inside-grid">
        <div className="content-icons"><ul className="b-purchase__list g-text-ellipsis"><li className="b-purchase__list-item"><svg className="m-icon-extra-sm m-aligned-top g-icon" data-icon-name="icon-media" aria-hidden="true"><use href="#icon-media"></use></svg><span className="b-purchase__list-item__count"> 1 </span></li></ul></div>
        <span className="b-btn-purchase-post"></span></div>
        </div>
        </a></div>
        </div>

        <div className="vue-recycle-scroller__item-view" style={{"transform": "translateY(201px)"}}>
        <div className="dynamic-scroller-item"><a data-id="2082423249" data-at-attr="photo_item" className="b-photos__item m-reset-wcag-link-focus m-square">
        <div className="b-post__unknown m-default-bg">
        <div className="b-post__unknown__icon m-grid-position"><svg className="g-icon" data-icon-name="icon-locked" aria-hidden="true"><use href="#icon-locked"></use></svg>
        <div className="b-post__unknown__price"></div>
        </div>
        <div className="b-subscribe-block m-inside-grid">
        <div className="content-icons"><ul className="b-purchase__list g-text-ellipsis"><li className="b-purchase__list-item"><svg className="m-icon-extra-sm m-aligned-top g-icon" data-icon-name="icon-media" aria-hidden="true"><use href="#icon-media"></use></svg><span className="b-purchase__list-item__count"> 1 </span></li></ul></div>
        <span className="b-btn-purchase-post"></span></div>
        </div>
        </a><a data-id="2082406308" data-at-attr="photo_item" className="b-photos__item m-reset-wcag-link-focus m-square">
        <div className="b-post__unknown m-default-bg">
        <div className="b-post__unknown__icon m-grid-position"><svg className="g-icon" data-icon-name="icon-locked" aria-hidden="true"><use href="#icon-locked"></use></svg>
        <div className="b-post__unknown__price"></div>
        </div>
        <div className="b-subscribe-block m-inside-grid">
        <div className="content-icons"><ul className="b-purchase__list g-text-ellipsis"><li className="b-purchase__list-item"><svg className="m-icon-extra-sm m-aligned-top g-icon" data-icon-name="icon-media" aria-hidden="true"><use href="#icon-media"></use></svg><span className="b-purchase__list-item__count"> 1 </span></li></ul></div>
        <span className="b-btn-purchase-post"></span></div>
        </div>
        </a><a data-id="2082398334" data-at-attr="photo_item" className="b-photos__item m-reset-wcag-link-focus m-square">
        <div className="b-post__unknown m-default-bg">
        <div className="b-post__unknown__icon m-grid-position"><svg className="g-icon" data-icon-name="icon-locked" aria-hidden="true"><use href="#icon-locked"></use></svg>
        <div className="b-post__unknown__price"></div>
        </div>
        <div className="b-subscribe-block m-inside-grid">
        <div className="content-icons"><ul className="b-purchase__list g-text-ellipsis"><li className="b-purchase__list-item"><svg className="m-icon-extra-sm m-aligned-top g-icon" data-icon-name="icon-media" aria-hidden="true"><use href="#icon-media"></use></svg><span className="b-purchase__list-item__count"> 1 </span></li></ul></div>
        <span className="b-btn-purchase-post"></span></div>
        </div>
        </a></div>
        </div>

        <div className="vue-recycle-scroller__item-view" style={{"transform": "translateY(402px)"}}>
        <div className="dynamic-scroller-item"><a data-id="2082391031" data-at-attr="photo_item" className="b-photos__item m-reset-wcag-link-focus m-square">
        <div className="b-post__unknown m-default-bg">
        <div className="b-post__unknown__icon m-grid-position"><svg className="g-icon" data-icon-name="icon-locked" aria-hidden="true"><use href="#icon-locked"></use></svg>
        <div className="b-post__unknown__price"></div>
        </div>
        <div className="b-subscribe-block m-inside-grid">
        <div className="content-icons"><ul className="b-purchase__list g-text-ellipsis"><li className="b-purchase__list-item"><svg className="m-icon-extra-sm m-aligned-top g-icon" data-icon-name="icon-media" aria-hidden="true"><use href="#icon-media"></use></svg><span className="b-purchase__list-item__count"> 1 </span></li></ul></div>
        <span className="b-btn-purchase-post"></span></div>
        </div>
        </a><a data-id="1986861708" data-at-attr="photo_item" className="b-photos__item m-reset-wcag-link-focus m-square">
        <div className="b-post__unknown m-default-bg">
        <div className="b-post__unknown__icon m-grid-position"><svg className="g-icon" data-icon-name="icon-locked" aria-hidden="true"><use href="#icon-locked"></use></svg>
        <div className="b-post__unknown__price"></div>
        </div>
        <div className="b-subscribe-block m-inside-grid">
        <div className="content-icons"><ul className="b-purchase__list g-text-ellipsis"><li className="b-purchase__list-item"><svg className="m-icon-extra-sm m-aligned-top g-icon" data-icon-name="icon-media" aria-hidden="true"><use href="#icon-media"></use></svg><span className="b-purchase__list-item__count"> 1 </span></li></ul></div>
        <span className="b-btn-purchase-post"></span></div>
        </div>
        </a><a data-id="1986860213" data-at-attr="photo_item" className="b-photos__item m-reset-wcag-link-focus m-square">
        <div className="b-post__unknown m-default-bg">
        <div className="b-post__unknown__icon m-grid-position"><svg className="g-icon" data-icon-name="icon-locked" aria-hidden="true"><use href="#icon-locked"></use></svg>
        <div className="b-post__unknown__price"></div>
        </div>
        <div className="b-subscribe-block m-inside-grid">
        <div className="content-icons"><ul className="b-purchase__list g-text-ellipsis"><li className="b-purchase__list-item"><svg className="m-icon-extra-sm m-aligned-top g-icon" data-icon-name="icon-media" aria-hidden="true"><use href="#icon-media"></use></svg><span className="b-purchase__list-item__count"> 1 </span></li></ul></div>
        <span className="b-btn-purchase-post"></span></div>
        </div>
        </a></div>
        </div>

        <div className="vue-recycle-scroller__item-view" style={{"transform": "translateY(603px)"}}>
        <div className="dynamic-scroller-item"><a data-id="1986843590" data-at-attr="photo_item" className="b-photos__item m-reset-wcag-link-focus m-square">
        <div className="b-post__unknown m-default-bg">
        <div className="b-post__unknown__icon m-grid-position"><svg className="g-icon" data-icon-name="icon-locked" aria-hidden="true"><use href="#icon-locked"></use></svg>
        <div className="b-post__unknown__price"></div>
        </div>
        <div className="b-subscribe-block m-inside-grid">
        <div className="content-icons"><ul className="b-purchase__list g-text-ellipsis"><li className="b-purchase__list-item"><svg className="m-icon-extra-sm m-aligned-top g-icon" data-icon-name="icon-media" aria-hidden="true"><use href="#icon-media"></use></svg><span className="b-purchase__list-item__count"> 1 </span></li></ul></div>
        <span className="b-btn-purchase-post"></span></div>
        </div>
        </a><a data-id="1986192924" data-at-attr="photo_item" className="m-reset-wcag-link-focus m-square m-video-item"><img src="/img/OB/stolzerBart.webp" alt="stolzer Bart" style={{"width": "100%", "height": "auto"}}/></a><a data-id="1986839967" data-at-attr="photo_item" className="b-photos__item m-reset-wcag-link-focus m-square">
        <div className="b-post__unknown m-default-bg">
        <div className="b-post__unknown__icon m-grid-position"><svg className="g-icon" data-icon-name="icon-locked" aria-hidden="true"><use href="#icon-locked"></use></svg>
        <div className="b-post__unknown__price"></div>
        </div>
        <div className="b-subscribe-block m-inside-grid">
        <div className="content-icons"><ul className="b-purchase__list g-text-ellipsis"><li className="b-purchase__list-item"><svg className="m-icon-extra-sm m-aligned-top g-icon" data-icon-name="icon-media" aria-hidden="true"><use href="#icon-media"></use></svg><span className="b-purchase__list-item__count"> 1 </span></li></ul></div>
        <span className="b-btn-purchase-post"></span></div>
        </div>
        </a></div>
        </div>

        <div className="vue-recycle-scroller__item-view" style={{"transform": "translateY(804px)"}}>
        <div className="dynamic-scroller-item"><a data-id="1986192924" data-at-attr="photo_item" className="m-reset-wcag-link-focus m-square m-video-item"><img src="/img/OB/KatzeBart.webp" alt="Katze und Bart" style={{"width": "100%", "height": "auto"}}/></a><a data-id="1986192924" data-at-attr="photo_item" className="m-reset-wcag-link-focus m-square m-video-item"><img src="/img/OB/hübscherBart.webp" alt="hübscher Bart" style={{"width": "100%", "height": "auto"}}/></a><a data-id="1986264440" data-at-attr="photo_item" className="b-photos__item m-reset-wcag-link-focus m-square">
        <div className="b-post__unknown m-default-bg">
        <div className="b-post__unknown__icon m-grid-position"><svg className="g-icon" data-icon-name="icon-locked" aria-hidden="true"><use href="#icon-locked"></use></svg>
        <div className="b-post__unknown__price"></div>
        </div>
        <div className="b-subscribe-block m-inside-grid">
        <div className="content-icons"><ul className="b-purchase__list g-text-ellipsis"><li className="b-purchase__list-item"><svg className="m-icon-extra-sm m-aligned-top g-icon" data-icon-name="icon-media" aria-hidden="true"><use href="#icon-media"></use></svg><span className="b-purchase__list-item__count"> 1 </span></li></ul></div>
        <span className="b-btn-purchase-post"></span></div>
        </div>
        </a></div>
        </div>

        <div className="vue-recycle-scroller__item-view" style={{"transform": "translateY(1005px)"}}>
        <div className="dynamic-scroller-item"><a data-id="1986259385" data-at-attr="photo_item" className="b-photos__item m-reset-wcag-link-focus m-square">
        <div className="b-post__unknown m-default-bg">
        <div className="b-post__unknown__icon m-grid-position"><svg className="g-icon" data-icon-name="icon-locked" aria-hidden="true"><use href="#icon-locked"></use></svg>
        <div className="b-post__unknown__price"></div>
        </div>
        <div className="b-subscribe-block m-inside-grid">
        <div className="content-icons"><ul className="b-purchase__list g-text-ellipsis"><li className="b-purchase__list-item"><svg className="m-icon-extra-sm m-aligned-top g-icon" data-icon-name="icon-media" aria-hidden="true"><use href="#icon-media"></use></svg><span className="b-purchase__list-item__count"> 1 </span></li></ul></div>
        <span className="b-btn-purchase-post"></span></div>
        </div>
        </a><a data-id="1986192924" data-at-attr="photo_item" className="m-reset-wcag-link-focus m-square m-video-item"><img src="/img/OB/HDKlo.webp" alt="Toiletten-Bart" style={{"width": "100%", "height": "auto"}}/></a><a data-id="1986192924" data-at-attr="photo_item" className="m-reset-wcag-link-focus m-square m-video-item"><img src="/img/OB/bartigerBart.webp" alt="bartiger Bart" style={{"width": "100%", "height": "auto"}}/></a></div>
        </div>

        <div className="vue-recycle-scroller__item-view" style={{"transform": "translateY(1206px)"}}>
        <div className="dynamic-scroller-item"><a data-id="1986192925" data-at-attr="photo_item" className="m-reset-wcag-link-focus m-square m-video-item"><img src="/img/OB/frostigerBart.webp" alt="frostiger Bart" style={{"width": "100%", "height": "auto"}}/></a><a data-id="1986218889" data-at-attr="photo_item" className="b-photos__item m-reset-wcag-link-focus m-square">
        <div className="b-post__unknown m-default-bg">
        <div className="b-post__unknown__icon m-grid-position"><svg className="g-icon" data-icon-name="icon-locked" aria-hidden="true"><use href="#icon-locked"></use></svg>
        <div className="b-post__unknown__price"></div>
        </div>
        <div className="b-subscribe-block m-inside-grid">
        <div className="content-icons"><ul className="b-purchase__list g-text-ellipsis"><li className="b-purchase__list-item"><svg className="m-icon-extra-sm m-aligned-top g-icon" data-icon-name="icon-media" aria-hidden="true"><use href="#icon-media"></use></svg><span className="b-purchase__list-item__count"> 1 </span></li></ul></div>
        <span className="b-btn-purchase-post"></span></div>
        </div>
        </a><a data-id="1986192924" data-at-attr="photo_item" href="https://www.twitch.tv/hd1920x1080/clip/FuriousViscousDinosaurTBTacoRight-LWx07dviaIvdHshD" className="m-reset-wcag-link-focus m-square m-video-item"><img src="/img/OB/festlicherBart.png" alt="festlicher Bart" style={{"width": "100%", "height": "auto"}}/></a></div>
        </div>
        </div>

        <div tabIndex={-1} className="resize-observer"></div>
        </div>
        </div>
        </div>
      )}

      {tab === 'media' && (
        <div className="user_posts">
        <div className="g-page-content__body">
        <div className="vue-recycle-scroller g-negative-sides-gaps ready page-mode direction-vertical b-photos b-photos-reduced-outline" data-buffer="768" data-page-mode="">
        <div className="vue-recycle-scroller__item-wrapper" style={{"minHeight": "1735px"}}>
        <div className="vue-recycle-scroller__item-view" style={{"transform": "translateY(0px)"}}>
        <div className="dynamic-scroller-item"><a data-id="1986192924" data-at-attr="photo_item" className="m-reset-wcag-link-focus m-square m-video-item"><img src="/img/OB/ZungenBart.webp" alt="Zungen-Bart" style={{"width": "100%", "height": "auto"}}/></a><a data-id="2082448600" data-at-attr="photo_item" className="b-photos__item m-reset-wcag-link-focus m-square">
        <div className="b-post__unknown m-default-bg">
        <div className="b-post__unknown__icon m-grid-position"><svg className="g-icon" data-icon-name="icon-locked" aria-hidden="true"><use href="#icon-locked"></use></svg>
        <div className="b-post__unknown__price"></div>
        </div>
        <div className="b-subscribe-block m-inside-grid">
        <div className="content-icons"><ul className="b-purchase__list g-text-ellipsis"><li className="b-purchase__list-item"><svg className="m-icon-extra-sm m-aligned-top g-icon" data-icon-name="icon-media" aria-hidden="true"><use href="#icon-media"></use></svg><span className="b-purchase__list-item__count"> 1 </span></li></ul></div>
        <span className="b-btn-purchase-post"></span></div>
        </div>
        </a><a data-id="2082423249" data-at-attr="photo_item" className="b-photos__item m-reset-wcag-link-focus m-square">
        <div className="b-post__unknown m-default-bg">
        <div className="b-post__unknown__icon m-grid-position"><svg className="g-icon" data-icon-name="icon-locked" aria-hidden="true"><use href="#icon-locked"></use></svg>
        <div className="b-post__unknown__price"></div>
        </div>
        <div className="b-subscribe-block m-inside-grid">
        <div className="content-icons"><ul className="b-purchase__list g-text-ellipsis"><li className="b-purchase__list-item"><svg className="m-icon-extra-sm m-aligned-top g-icon" data-icon-name="icon-media" aria-hidden="true"><use href="#icon-media"></use></svg><span className="b-purchase__list-item__count"> 1 </span></li></ul></div>
        <span className="b-btn-purchase-post"></span></div>
        </div>
        </a></div>
        </div>

        <div className="vue-recycle-scroller__item-view" style={{"transform": "translateY(201px)"}}>
        <div className="dynamic-scroller-item"><a data-id="2082406308" data-at-attr="photo_item" className="b-photos__item m-reset-wcag-link-focus m-square">
        <div className="b-post__unknown m-default-bg">
        <div className="b-post__unknown__icon m-grid-position"><svg className="g-icon" data-icon-name="icon-locked" aria-hidden="true"><use href="#icon-locked"></use></svg>
        <div className="b-post__unknown__price"></div>
        </div>
        <div className="b-subscribe-block m-inside-grid">
        <div className="content-icons"><ul className="b-purchase__list g-text-ellipsis"><li className="b-purchase__list-item"><svg className="m-icon-extra-sm m-aligned-top g-icon" data-icon-name="icon-media" aria-hidden="true"><use href="#icon-media"></use></svg><span className="b-purchase__list-item__count"> 1 </span></li></ul></div>
        <span className="b-btn-purchase-post"></span></div>
        </div>
        </a><a data-id="2082398334" data-at-attr="photo_item" className="b-photos__item m-reset-wcag-link-focus m-square">
        <div className="b-post__unknown m-default-bg">
        <div className="b-post__unknown__icon m-grid-position"><svg className="g-icon" data-icon-name="icon-locked" aria-hidden="true"><use href="#icon-locked"></use></svg>
        <div className="b-post__unknown__price"></div>
        </div>
        <div className="b-subscribe-block m-inside-grid">
        <div className="content-icons"><ul className="b-purchase__list g-text-ellipsis"><li className="b-purchase__list-item"><svg className="m-icon-extra-sm m-aligned-top g-icon" data-icon-name="icon-media" aria-hidden="true"><use href="#icon-media"></use></svg><span className="b-purchase__list-item__count"> 1 </span></li></ul></div>
        <span className="b-btn-purchase-post"></span></div>
        </div>
        </a><a data-id="2082391031" data-at-attr="photo_item" className="b-photos__item m-reset-wcag-link-focus m-square">
        <div className="b-post__unknown m-default-bg">
        <div className="b-post__unknown__icon m-grid-position"><svg className="g-icon" data-icon-name="icon-locked" aria-hidden="true"><use href="#icon-locked"></use></svg>
        <div className="b-post__unknown__price"></div>
        </div>
        <div className="b-subscribe-block m-inside-grid">
        <div className="content-icons"><ul className="b-purchase__list g-text-ellipsis"><li className="b-purchase__list-item"><svg className="m-icon-extra-sm m-aligned-top g-icon" data-icon-name="icon-media" aria-hidden="true"><use href="#icon-media"></use></svg><span className="b-purchase__list-item__count"> 1 </span></li></ul></div>
        <span className="b-btn-purchase-post"></span></div>
        </div>
        </a></div>
        </div>

        <div className="vue-recycle-scroller__item-view" style={{"transform": "translateY(402px)"}}>
        <div className="dynamic-scroller-item"><a data-id="1986861708" data-at-attr="photo_item" className="b-photos__item m-reset-wcag-link-focus m-square">
        <div className="b-post__unknown m-default-bg">
        <div className="b-post__unknown__icon m-grid-position"><svg className="g-icon" data-icon-name="icon-locked" aria-hidden="true"><use href="#icon-locked"></use></svg>
        <div className="b-post__unknown__price"></div>
        </div>
        <div className="b-subscribe-block m-inside-grid">
        <div className="content-icons"><ul className="b-purchase__list g-text-ellipsis"><li className="b-purchase__list-item"><svg className="m-icon-extra-sm m-aligned-top g-icon" data-icon-name="icon-media" aria-hidden="true"><use href="#icon-media"></use></svg><span className="b-purchase__list-item__count"> 1 </span></li></ul></div>
        <span className="b-btn-purchase-post"></span></div>
        </div>
        </a><a data-id="1986843590" data-at-attr="photo_item" className="b-photos__item m-reset-wcag-link-focus m-square">
        <div className="b-post__unknown m-default-bg">
        <div className="b-post__unknown__icon m-grid-position"><svg className="g-icon" data-icon-name="icon-locked" aria-hidden="true"><use href="#icon-locked"></use></svg>
        <div className="b-post__unknown__price"></div>
        </div>
        <div className="b-subscribe-block m-inside-grid">
        <div className="content-icons"><ul className="b-purchase__list g-text-ellipsis"><li className="b-purchase__list-item"><svg className="m-icon-extra-sm m-aligned-top g-icon" data-icon-name="icon-media" aria-hidden="true"><use href="#icon-media"></use></svg><span className="b-purchase__list-item__count"> 1 </span></li></ul></div>
        <span className="b-btn-purchase-post"></span></div>
        </div>
        </a><a data-id="1986842640" data-at-attr="photo_item" className="b-photos__item m-reset-wcag-link-focus m-square">
        <div className="b-post__unknown m-default-bg">
        <div className="b-post__unknown__icon m-grid-position"><svg className="g-icon" data-icon-name="icon-locked" aria-hidden="true"><use href="#icon-locked"></use></svg>
        <div className="b-post__unknown__price"></div>
        </div>
        <div className="b-subscribe-block m-inside-grid">
        <div className="content-icons"><ul className="b-purchase__list g-text-ellipsis"><li className="b-purchase__list-item"><svg className="m-icon-extra-sm m-aligned-top g-icon" data-icon-name="icon-media" aria-hidden="true"><use href="#icon-media"></use></svg><span className="b-purchase__list-item__count"> 1 </span></li></ul></div>
        <span className="b-btn-purchase-post"></span></div>
        </div>
        </a></div>
        </div>

        <div className="vue-recycle-scroller__item-view" style={{"transform": "translateY(603px)"}}>
        <div className="dynamic-scroller-item"><a data-id="1986192924" data-at-attr="photo_item" className="m-reset-wcag-link-focus m-square m-video-item"><img src="/img/OB/stolzerBart.webp" alt="stolzer Bart" style={{"width": "100%", "height": "auto"}}/></a><a data-id="1986834987" data-at-attr="photo_item" className="b-photos__item m-reset-wcag-link-focus m-square">
        <div className="b-post__unknown m-default-bg">
        <div className="b-post__unknown__icon m-grid-position"><svg className="g-icon" data-icon-name="icon-locked" aria-hidden="true"><use href="#icon-locked"></use></svg>
        <div className="b-post__unknown__price"></div>
        </div>
        <div className="b-subscribe-block m-inside-grid">
        <div className="content-icons"><ul className="b-purchase__list g-text-ellipsis"><li className="b-purchase__list-item"><svg className="m-icon-extra-sm m-aligned-top g-icon" data-icon-name="icon-media" aria-hidden="true"><use href="#icon-media"></use></svg><span className="b-purchase__list-item__count"> 1 </span></li></ul></div>
        <span className="b-btn-purchase-post"></span></div>
        </div>
        </a><a data-id="1986192924" data-at-attr="photo_item" className="m-reset-wcag-link-focus m-square m-video-item"><img src="/img/OB/KatzeBart.webp" alt="Katze und Bart" style={{"width": "100%", "height": "auto"}}/></a></div>
        </div>

        <div className="vue-recycle-scroller__item-view" style={{"transform": "translateY(804px)"}}>
        <div className="dynamic-scroller-item"><a data-id="1986192924" data-at-attr="photo_item" className="m-reset-wcag-link-focus m-square m-video-item"><img src="/img/OB/hübscherBart.webp" alt="hübscher Bart" style={{"width": "100%", "height": "auto"}}/></a><a data-id="1986259385" data-at-attr="photo_item" className="b-photos__item m-reset-wcag-link-focus m-square">
        <div className="b-post__unknown m-default-bg">
        <div className="b-post__unknown__icon m-grid-position"><svg className="g-icon" data-icon-name="icon-locked" aria-hidden="true"><use href="#icon-locked"></use></svg>
        <div className="b-post__unknown__price"></div>
        </div>
        <div className="b-subscribe-block m-inside-grid">
        <div className="content-icons"><ul className="b-purchase__list g-text-ellipsis"><li className="b-purchase__list-item"><svg className="m-icon-extra-sm m-aligned-top g-icon" data-icon-name="icon-media" aria-hidden="true"><use href="#icon-media"></use></svg><span className="b-purchase__list-item__count"> 1 </span></li></ul></div>
        <span className="b-btn-purchase-post"></span></div>
        </div>
        </a><a data-id="1986232811" data-at-attr="photo_item" className="b-photos__item m-reset-wcag-link-focus m-square">
        <div className="b-post__unknown m-default-bg">
        <div className="b-post__unknown__icon m-grid-position"><svg className="g-icon" data-icon-name="icon-locked" aria-hidden="true"><use href="#icon-locked"></use></svg>
        <div className="b-post__unknown__price"></div>
        </div>
        <div className="b-subscribe-block m-inside-grid">
        <div className="content-icons"><ul className="b-purchase__list g-text-ellipsis"><li className="b-purchase__list-item"><svg className="m-icon-extra-sm m-aligned-top g-icon" data-icon-name="icon-media" aria-hidden="true"><use href="#icon-media"></use></svg><span className="b-purchase__list-item__count"> 1 </span></li></ul></div>
        <span className="b-btn-purchase-post"></span></div>
        </div>
        </a></div>
        </div>

        <div className="vue-recycle-scroller__item-view" style={{"transform": "translateY(1005px)"}}>
        <div className="dynamic-scroller-item"><a data-id="1986192924" data-at-attr="photo_item" className="m-reset-wcag-link-focus m-square m-video-item"><img src="/img/OB/HDKlo.webp" alt="Toiletten-Bart" style={{"width": "100%", "height": "auto"}}/></a><a data-id="1986192924" data-at-attr="photo_item" className="m-reset-wcag-link-focus m-square m-video-item"><img src="/img/OB/bartigerBart.webp" alt="bartiger Bart" style={{"width": "100%", "height": "auto"}}/></a><a data-id="1986192924" data-at-attr="photo_item" className="m-reset-wcag-link-focus m-square m-video-item"><img src="/img/OB/frostigerBart.webp" alt="frostiger Bart" style={{"width": "100%", "height": "auto"}}/></a></div>
        </div>

        <div className="vue-recycle-scroller__item-view" style={{"transform": "translateY(1206px)"}}>
        <div className="dynamic-scroller-item"><a data-id="1986215487" data-at-attr="photo_item" className="b-photos__item m-reset-wcag-link-focus m-square">
        <div className="b-post__unknown m-default-bg">
        <div className="b-post__unknown__icon m-grid-position"><svg className="g-icon" data-icon-name="icon-locked" aria-hidden="true"><use href="#icon-locked"></use></svg>
        <div className="b-post__unknown__price"></div>
        </div>
        <div className="b-subscribe-block m-inside-grid">
        <div className="content-icons"><ul className="b-purchase__list g-text-ellipsis"></ul></div>
        <span className="b-btn-purchase-post"></span></div>
        </div>
        </a><a data-id="1986199156" data-at-attr="photo_item" className="b-photos__item m-reset-wcag-link-focus m-square">
        <div className="b-post__unknown m-default-bg">
        <div className="b-post__unknown__icon m-grid-position"><svg className="g-icon" data-icon-name="icon-locked" aria-hidden="true"><use href="#icon-locked"></use></svg>
        <div className="b-post__unknown__price"></div>
        </div>
        <div className="b-subscribe-block m-inside-grid">
        <div className="content-icons"><ul className="b-purchase__list g-text-ellipsis"></ul></div>
        <span className="b-btn-purchase-post"></span></div>
        </div>
        </a><a data-id="1986192924" data-at-attr="photo_item" href="https://www.twitch.tv/hd1920x1080/clip/FuriousViscousDinosaurTBTacoRight-LWx07dviaIvdHshD" className="m-reset-wcag-link-focus m-square m-video-item"><img src="/img/OB/festlicherBart.png" alt="festlicher Bart" style={{"width": "100%", "height": "auto"}}/></a></div>
        </div>
        </div>

        <div tabIndex={-1} className="resize-observer"></div>
        </div>
        </div>
        </div>
      )}

      </div></div></div>

      {isGallery && (
        <div className="l-wrapper__sidebar" style={{"height": "auto", "position": "relative"}}><a href="mailto:admin@hd1920x1080.de?subject=OnlyBart%20Anfrage" className="contact_button m-reset-wcag-link-focus visible-lg has-tooltip" data-original-title="null" aria-label="Hilfe &amp; Support"><svg data-icon-name="icon-support" aria-hidden="true" className="g-icon"><use href="#icon-support"></use></svg></a>
        <div data-at-modals-host="" className="modals-host"></div>
        <div aria-hidden="true" className="safari-page-scroll-hack"><input id="safari-page-scroll-hack" type="text" tabIndex={-1}/></div>
        </div>
      )}
      </div></main></div></div>
    </div>
  )
}
