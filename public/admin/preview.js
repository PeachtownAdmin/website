/*
  Preview panes for the CMS editor.

  Shows the home page as the editor types: photographs at the aspect ratio the
  site actually crops them to, and the headings around them. The crop itself is
  chosen with the imagefocus widget in crop-widget.js.

  Written against window.h, which Decap exposes as React.createElement, so
  there is no build step or JSX here.
*/

(function () {
  var h = window.h;
  if (!h || !window.CMS) return;

  // Match the aspect ratios the site crops to. The banner is capped by height
  // rather than by a fixed ratio, so this is the shape it takes on a typical
  // desktop window.
  var HERO_RATIO = "5 / 2";
  var CARD_RATIO = "4 / 3";

  var INK = "#0b2116";
  var PAPER = "#f5f1e6";
  var DIM = "#e8e2d2";
  var MUTED = "#55605a";
  var AMBER = "#c8791f";

  // Photos are stored as { src, x, y } by the crop widget.
  function photo(value) {
    if (!value) return { src: "", x: 50, y: 50 };
    if (typeof value === "string") return { src: value, x: 50, y: 50 };
    return {
      src: value.src || "",
      x: typeof value.x === "number" ? value.x : 50,
      y: typeof value.y === "number" ? value.y : 50,
    };
  }

  function assetUrl(getAsset, value) {
    if (!value) return "";
    try {
      return String(getAsset(value) || "");
    } catch (err) {
      return String(value);
    }
  }

  function list(entry, field) {
    var value = entry.getIn(["data", field]);
    if (!value) return [];
    return typeof value.toJS === "function" ? value.toJS() : value;
  }

  function frame(src, ratio, pos, label) {
    return h(
      "div",
      { style: { marginBottom: "18px" } },
      h("div", {
        style: {
          aspectRatio: ratio,
          width: "100%",
          background: src ? INK : DIM,
          backgroundImage: src ? "url(" + src + ")" : "none",
          backgroundSize: "cover",
          backgroundPosition: pos,
          border: "1px solid " + DIM,
        },
      }),
      label
        ? h(
            "p",
            {
              style: {
                margin: "6px 0 0",
                fontSize: "12px",
                color: MUTED,
                fontFamily: "system-ui, sans-serif",
              },
            },
            label
          )
        : null
    );
  }

  function heading(text) {
    return h(
      "h2",
      {
        style: {
          font: "600 13px/1.3 system-ui, sans-serif",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: MUTED,
          margin: "26px 0 10px",
          paddingBottom: "6px",
          borderBottom: "2px solid " + INK,
        },
      },
      text
    );
  }

  function HomePreview(props) {
    var entry = props.entry;
    var getAsset = props.getAsset;

    var slides = list(entry, "heroSlides");
    var highlights = list(entry, "highlights");

    return h(
      "div",
      {
        style: {
          padding: "20px 22px 40px",
          background: PAPER,
          color: INK,
          fontFamily: "system-ui, sans-serif",
          minHeight: "100%",
        },
      },

      h(
        "p",
        { style: { margin: 0, fontSize: "12px", color: MUTED } },
        "This is roughly how the photos will be cropped on the website."
      ),

      heading("Photos at the top"),
      slides.length === 0
        ? h("p", { style: { color: MUTED, fontSize: "13px" } }, "No photos added yet.")
        : slides.map(function (slide, i) {
            return h(
              "div",
              { key: "slide" + i },
              (function () {
                var p = photo(slide.image);
                return frame(
                  assetUrl(getAsset, p.src),
                  HERO_RATIO,
                  p.x + "% " + p.y + "%",
                  "Photo " + (i + 1) + (slide.alt ? " - " + slide.alt : "")
                );
              })()
            );
          }),

      h(
        "div",
        {
          style: {
            background: INK,
            color: PAPER,
            padding: "18px 20px",
            marginTop: "4px",
          },
        },
        h(
          "p",
          {
            style: {
              margin: "0 0 6px",
              fontSize: "11px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#e8a24a",
            },
          },
          entry.getIn(["data", "heroEyebrow"]) || ""
        ),
        h(
          "p",
          { style: { margin: "0 0 8px", font: "600 26px/1.15 Georgia, serif" } },
          entry.getIn(["data", "heroHeading"]) || "Headline"
        ),
        h(
          "p",
          { style: { margin: 0, fontSize: "14px", opacity: 0.9 } },
          entry.getIn(["data", "heroLede"]) || ""
        )
      ),

      heading("Highlight cards"),
      highlights.length === 0
        ? h("p", { style: { color: MUTED, fontSize: "13px" } }, "No highlights added yet.")
        : h(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
                gap: "14px",
              },
            },
            highlights.map(function (item, i) {
              var p = photo(item.image);
              return h(
                "div",
                { key: "hl" + i, style: { background: PAPER, border: "1px solid " + DIM } },
                h("div", {
                  style: {
                    aspectRatio: CARD_RATIO,
                    background: p.src ? INK : DIM,
                    backgroundImage: p.src ? "url(" + assetUrl(getAsset, p.src) + ")" : "none",
                    backgroundSize: "cover",
                    backgroundPosition: p.x + "% " + p.y + "%",
                  },
                }),
                h(
                  "div",
                  { style: { padding: "8px 10px 12px", borderTop: "3px solid " + AMBER } },
                  h(
                    "p",
                    {
                      style: {
                        margin: "0 0 2px",
                        fontSize: "10px",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: MUTED,
                      },
                    },
                    item.tag || ""
                  ),
                  h(
                    "p",
                    { style: { margin: "0 0 4px", font: "600 16px/1.15 Georgia, serif" } },
                    item.title || "Title"
                  ),
                  h(
                    "p",
                    { style: { margin: 0, fontSize: "12px", color: MUTED } },
                    item.note || ""
                  )
                )
              );
            })
          )
    );
  }

  function SitePreview(props) {
    var entry = props.entry;
    var rows = [
      ["School name", entry.getIn(["data", "schoolName"])],
      ["Short name", entry.getIn(["data", "shortName"])],
      ["Tagline", entry.getIn(["data", "tagline"])],
      ["Phone", entry.getIn(["data", "phone"])],
      ["Email", entry.getIn(["data", "email"])],
      ["Office hours", entry.getIn(["data", "officeHours"])],
    ];

    return h(
      "div",
      {
        style: {
          padding: "22px",
          background: PAPER,
          color: INK,
          fontFamily: "system-ui, sans-serif",
          minHeight: "100%",
        },
      },
      h(
        "p",
        { style: { margin: "0 0 14px", fontSize: "12px", color: MUTED } },
        "These details appear in the footer and page titles across the site."
      ),
      rows.map(function (row, i) {
        return h(
          "div",
          {
            key: "row" + i,
            style: { padding: "8px 0", borderBottom: "1px solid " + DIM },
          },
          h(
            "span",
            {
              style: {
                display: "block",
                fontSize: "11px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: MUTED,
              },
            },
            row[0]
          ),
          h("span", { style: { fontSize: "15px" } }, row[1] || "Not set")
        );
      })
    );
  }

  window.CMS.registerPreviewTemplate("home", HomePreview);
  window.CMS.registerPreviewTemplate("site", SitePreview);
})();
