(function () {
  "use strict";

  let images = [];
  let currentIndex = 0;
  let overlay = null;
  let imageEl = null;
  let closeBtn = null;
  let prevBtn = null;
  let nextBtn = null;
  let counter = null;
  let touchStartX = 0;
  let touchStartY = 0;
  let previousOverflow = "";

  function collectImages() {
    images = Array.from(document.querySelectorAll("main img"))
      .filter(function (img) {
        if (!img) return false;

        /* Exclude hero images */
        if (img.closest(".hero")) return false;

        /* Exclude lightbox image */
        if (img.closest("#global-lightbox")) return false;

        /* Exclude logos/icons */
        if (
          img.closest("header .logo") ||
          img.closest(".logo") ||
          img.classList.contains("logo")
        ) {
          return false;
        }

        return true;
      });

    images.forEach(function (img, index) {
      if (img.dataset.lightboxAttached === "true") return;

      img.dataset.lightboxAttached = "true";
      img.style.cursor = "pointer";

      img.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        open(index);
      });
    });
  }

  function createLightbox() {
    if (document.getElementById("global-lightbox")) {
      overlay = document.getElementById("global-lightbox");
      imageEl = overlay.querySelector(".glb-image");
      closeBtn = overlay.querySelector(".glb-close");
      prevBtn = overlay.querySelector(".glb-prev");
      nextBtn = overlay.querySelector(".glb-next");
      counter = overlay.querySelector(".glb-counter");
      return;
    }

    overlay = document.createElement("div");
    overlay.id = "global-lightbox";
    overlay.setAttribute("aria-hidden", "true");

    overlay.innerHTML = `
      <button class="glb-close" type="button" aria-label="Close image">×</button>
      <button class="glb-prev" type="button" aria-label="Previous image">‹</button>

      <div class="glb-stage">
        <img class="glb-image" alt="">
        <div class="glb-counter"></div>
      </div>

      <button class="glb-next" type="button" aria-label="Next image">›</button>
    `;

    document.body.appendChild(overlay);

    imageEl = overlay.querySelector(".glb-image");
    closeBtn = overlay.querySelector(".glb-close");
    prevBtn = overlay.querySelector(".glb-prev");
    nextBtn = overlay.querySelector(".glb-next");
    counter = overlay.querySelector(".glb-counter");

    closeBtn.addEventListener("click", function (event) {
      event.stopPropagation();
      close();
    });

    prevBtn.addEventListener("click", function (event) {
      event.stopPropagation();
      previous();
    });

    nextBtn.addEventListener("click", function (event) {
      event.stopPropagation();
      next();
    });

    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) {
        close();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (!overlay.classList.contains("open")) return;

      if (event.key === "Escape") {
        close();
      } else if (event.key === "ArrowLeft") {
        previous();
      } else if (event.key === "ArrowRight") {
        next();
      }
    });

    overlay.addEventListener(
      "touchstart",
      function (event) {
        const touch = event.changedTouches[0];

        touchStartX = touch.screenX;
        touchStartY = touch.screenY;
      },
      { passive: true }
    );

    overlay.addEventListener(
      "touchend",
      function (event) {
        const touch = event.changedTouches[0];

        const deltaX = touch.screenX - touchStartX;
        const deltaY = touch.screenY - touchStartY;

        if (
          Math.abs(deltaX) > 50 &&
          Math.abs(deltaX) > Math.abs(deltaY)
        ) {
          if (deltaX < 0) {
            next();
          } else {
            previous();
          }
        }
      },
      { passive: true }
    );
  }

  function open(index) {
    if (!images.length) return;

    currentIndex =
      (index + images.length) % images.length;

    const source = images[currentIndex];

    imageEl.src =
      source.currentSrc ||
      source.src ||
      source.getAttribute("src");

    imageEl.alt =
      source.alt ||
      "Photography image";

    counter.textContent =
      (currentIndex + 1) +
      " / " +
      images.length;

    previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");

    /*
     * Add browser history state so the mobile/browser
     * Back button closes the viewer first.
     */
    if (!history.state || history.state.lightbox !== true) {
      history.pushState(
        { lightbox: true },
        "",
        "#image-viewer"
      );
    }
  }

  function close(fromPopState) {
    if (!overlay) return;

    if (!overlay.classList.contains("open")) return;

    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");

    imageEl.src = "";

    document.body.style.overflow = previousOverflow;

    if (!fromPopState && history.state && history.state.lightbox === true) {
      history.back();
    }
  }

  function next() {
    if (!images.length) return;

    currentIndex =
      (currentIndex + 1) % images.length;

    update();
  }

  function previous() {
    if (!images.length) return;

    currentIndex =
      (currentIndex - 1 + images.length) %
      images.length;

    update();
  }

  function update() {
    const source = images[currentIndex];

    imageEl.src =
      source.currentSrc ||
      source.src ||
      source.getAttribute("src");

    imageEl.alt =
      source.alt ||
      "Photography image";

    counter.textContent =
      (currentIndex + 1) +
      " / " +
      images.length;
  }

  window.addEventListener("popstate", function () {
    if (overlay && overlay.classList.contains("open")) {
      close(true);
    }
  });

  function addStyles() {
    if (document.getElementById("global-lightbox-style")) return;

    const style = document.createElement("style");
    style.id = "global-lightbox-style";

    style.textContent = `
      #global-lightbox {
        position: fixed;
        inset: 0;
        z-index: 999999;
        display: none;
        align-items: center;
        justify-content: center;
        background: rgba(0,0,0,.97);
        padding: 20px;
        box-sizing: border-box;
      }

      #global-lightbox.open {
        display: flex;
      }

      #global-lightbox .glb-stage {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        position: relative;
      }

      #global-lightbox .glb-image {
        display: block;
        max-width: 94vw;
        max-height: 88vh;
        width: auto;
        height: auto;
        object-fit: contain;
        user-select: none;
        -webkit-user-drag: none;
      }

      #global-lightbox button {
        position: absolute;
        z-index: 2;
        border: 0;
        color: #fff;
        background: rgba(0,0,0,.45);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
        font-family: Arial, sans-serif;
      }

      #global-lightbox .glb-close {
        top: 18px;
        right: 18px;
        width: 46px;
        height: 46px;
        border-radius: 50%;
        font-size: 32px;
      }

      #global-lightbox .glb-prev,
      #global-lightbox .glb-next {
        top: 50%;
        transform: translateY(-50%);
        width: 52px;
        height: 66px;
        font-size: 42px;
      }

      #global-lightbox .glb-prev {
        left: 18px;
      }

      #global-lightbox .glb-next {
        right: 18px;
      }

      #global-lightbox .glb-counter {
        margin-top: 12px;
        color: #fff;
        font-size: 13px;
        letter-spacing: 1px;
      }

      @media (max-width: 600px) {
        #global-lightbox {
          padding: 10px;
        }

        #global-lightbox .glb-image {
          max-width: 96vw;
          max-height: 82vh;
        }

        #global-lightbox .glb-close {
          top: 10px;
          right: 10px;
          width: 42px;
          height: 42px;
          font-size: 30px;
        }

        #global-lightbox .glb-prev,
        #global-lightbox .glb-next {
          width: 42px;
          height: 52px;
          font-size: 34px;
        }

        #global-lightbox .glb-prev {
          left: 8px;
        }

        #global-lightbox .glb-next {
          right: 8px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function init() {
    addStyles();
    createLightbox();
    collectImages();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
