/*
  Shows the month and year on each card in the media library.

  The ordering itself is not done here. Reordering the rendered cards was
  tried and would not hold, so the file list is sorted at the source instead,
  by a patch applied to the Decap bundle in tools/sync-cms-bundle.mjs. This
  file only adds the label, which is cosmetic and safe to fail.

  Cards are found through the filename captions rather than the image URLs,
  because the local backend serves media as blob: URLs with no filename in
  them. Keying off the caption also confines this to the media library: no
  other part of the editor prints a media filename.
*/

(function () {
  var FILENAME = /(\d{4})-(\d{2})-(\d{2})-\S*\.(?:jpe?g|png|webp|gif|svg)/i;
  var ANY_FILE = /\.(?:jpe?g|png|webp|gif|svg)\s*$/i;
  var MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  var style = document.createElement("style");
  style.textContent =
    "[data-pt-date]{position:relative}" +
    "[data-pt-date]::after{" +
    "content:attr(data-pt-date);" +
    "position:absolute;top:4px;right:4px;z-index:2;" +
    "padding:1px 5px;border-radius:2px;" +
    "background:rgba(11,33,22,0.88);color:#f5f1e6;" +
    "font:600 10px/1.5 system-ui,sans-serif;letter-spacing:0.02em;" +
    "pointer-events:none}";
  document.head.appendChild(style);

  function apply() {
    var all = document.querySelectorAll("div,span,p,figcaption,td,li");

    for (var i = 0; i < all.length; i++) {
      var caption = all[i];
      if (caption.children.length !== 0) continue;

      var text = (caption.textContent || "").trim();
      if (text.length < 5 || text.length > 200) continue;
      if (!ANY_FILE.test(text)) continue;

      var match = FILENAME.exec(text);
      var label =
        match && match[1] !== "0000"
          ? MONTHS[Number(match[2]) - 1] + " " + match[1]
          : "No date";

      // The card is the nearest ancestor that also holds the thumbnail.
      var card = caption.parentElement;
      while (card && !card.querySelector("img")) card = card.parentElement;
      if (!card) continue;

      if (card.getAttribute("data-pt-date") !== label) {
        card.setAttribute("data-pt-date", label);
      }
    }
  }

  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(function () {
      queued = false;
      try {
        apply();
      } catch (err) {
        /* never take the editor down over a cosmetic label */
      }
    });
  }

  new MutationObserver(schedule).observe(document.body, {
    childList: true,
    subtree: true,
  });
  schedule();
})();
