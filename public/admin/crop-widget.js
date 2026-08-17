/*
  imagefocus widget: pick a photo, then drag to choose what survives the crop.

  Photos on the site are cropped to fixed shapes with CSS object-fit, so the
  only thing an editor needs to control is which part of the frame is kept.
  This shows the whole photograph with the crop window drawn on top, and lets
  it be dragged, the way BIRME does.

  The stored value is { src, x, y } where x and y are percentages that map
  directly onto object-position, so no image is ever re-encoded.

  Written against window.h and window.createClass, which Decap exposes, so
  there is no build step here.
*/

(function () {
  var h = window.h;
  var createClass = window.createClass;
  if (!h || !createClass || !window.CMS) return;

  var INK = "#0b2116";
  var PAPER = "#f5f1e6";
  var DIM = "#e8e2d2";
  var MUTED = "#55605a";
  var AMBER = "#c8791f";

  function clamp(n) {
    return Math.max(0, Math.min(100, n));
  }

  function toPlain(value) {
    if (value === null || value === undefined) return null;
    if (typeof value.toJS === "function") return value.toJS();
    return value;
  }

  // Older entries stored a bare path, and before that a top/middle/bottom
  // keyword. Both still open cleanly.
  function normalise(value) {
    var raw = toPlain(value);
    if (!raw) return { src: "", x: 50, y: 50 };
    if (typeof raw === "string") return { src: raw, x: 50, y: 50 };
    var y = typeof raw.y === "number" ? raw.y : 50;
    if (raw.focus === "top") y = 20;
    if (raw.focus === "bottom") y = 80;
    return {
      src: raw.src || raw.image || "",
      x: typeof raw.x === "number" ? raw.x : 50,
      y: y,
    };
  }

  function parseRatio(field) {
    var raw = (field && field.get && field.get("ratio")) || "3/2";
    var parts = String(raw).split("/");
    var w = Number(parts[0]);
    var hgt = Number(parts[1]);
    if (!w || !hgt) return 1.5;
    return w / hgt;
  }

  var Control = createClass({
    getInitialState: function () {
      return { natural: null, dragging: false, failed: false };
    },

    value: function () {
      return normalise(this.props.value);
    },

    commit: function (next) {
      try {
        this.props.onChange(next);
      } catch (err) {
        this.setState({ failed: true });
      }
    },

    // Decap reports the chosen file through mediaPaths, keyed by control id.
    componentDidUpdate: function (prev) {
      var id = this.props.forID;
      if (!this.props.mediaPaths || !id) return;
      var picked = this.props.mediaPaths.get(id);
      var before = prev.mediaPaths && prev.mediaPaths.get(id);
      if (!picked || picked === before) return;

      var path = toPlain(picked);
      if (Array.isArray(path)) path = path[0];
      if (typeof path !== "string" || !path) return;

      var current = this.value();
      this.setState({ natural: null });
      this.commit({ src: path, x: current.x, y: current.y });
    },

    openLibrary: function () {
      try {
        this.props.onOpenMediaLibrary({
          controlID: this.props.forID,
          forImage: true,
          value: this.value().src,
          field: this.props.field,
        });
      } catch (err) {
        this.setState({ failed: true });
      }
    },

    clear: function () {
      this.commit({ src: "", x: 50, y: 50 });
    },

    onImageLoad: function (event) {
      var img = event.target;
      this.setState({ natural: { w: img.naturalWidth, h: img.naturalHeight } });
    },

    // Drag maths. The crop window can only travel along the axis where the
    // photograph overflows, so only that axis is updated.
    pointerToValue: function (event, frame) {
      var box = frame.getBoundingClientRect();
      var ratio = parseRatio(this.props.field);
      var imageRatio = box.width / box.height;

      var cropW = box.width;
      var cropH = box.height;
      if (imageRatio > ratio) cropW = box.height * ratio;
      else cropH = box.width / ratio;

      var slackX = box.width - cropW;
      var slackY = box.height - cropH;

      var current = this.value();
      var x = current.x;
      var y = current.y;

      if (slackX > 1) {
        var left = event.clientX - box.left - cropW / 2;
        x = clamp((left / slackX) * 100);
      }
      if (slackY > 1) {
        var top = event.clientY - box.top - cropH / 2;
        y = clamp((top / slackY) * 100);
      }
      return { src: current.src, x: Math.round(x), y: Math.round(y) };
    },

    startDrag: function (event) {
      var frame = event.currentTarget;
      var self = this;
      event.preventDefault();

      var move = function (moveEvent) {
        self.commit(self.pointerToValue(moveEvent, frame));
      };
      var end = function () {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", end);
        self.setState({ dragging: false });
      };

      this.setState({ dragging: true });
      this.commit(this.pointerToValue(event, frame));
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", end);
    },

    nudge: function (event) {
      var current = this.value();
      var step = event.shiftKey ? 10 : 2;
      var next = null;
      if (event.key === "ArrowLeft") next = { x: clamp(current.x - step), y: current.y };
      if (event.key === "ArrowRight") next = { x: clamp(current.x + step), y: current.y };
      if (event.key === "ArrowUp") next = { x: current.x, y: clamp(current.y - step) };
      if (event.key === "ArrowDown") next = { x: current.x, y: clamp(current.y + step) };
      if (!next) return;
      event.preventDefault();
      this.commit({ src: current.src, x: Math.round(next.x), y: Math.round(next.y) });
    },

    renderFrame: function (url, ratio) {
      var current = this.value();
      var natural = this.state.natural;
      if (!natural) return null;

      var imageRatio = natural.w / natural.h;
      // Percentage geometry, so it holds at any rendered size.
      var cropWpc = 100;
      var cropHpc = 100;
      if (imageRatio > ratio) cropWpc = (ratio / imageRatio) * 100;
      else cropHpc = (imageRatio / ratio) * 100;

      var leftPc = ((100 - cropWpc) * current.x) / 100;
      var topPc = ((100 - cropHpc) * current.y) / 100;

      var shade = "rgba(11,33,22,0.62)";

      return h(
        "div",
        {
          onPointerDown: this.startDrag,
          onKeyDown: this.nudge,
          tabIndex: 0,
          role: "application",
          "aria-label": "Drag to choose which part of the photo is kept",
          style: {
            position: "relative",
            width: "100%",
            maxWidth: "460px",
            aspectRatio: natural.w + " / " + natural.h,
            backgroundImage: "url(" + url + ")",
            backgroundSize: "cover",
            backgroundPosition: "center",
            cursor: this.state.dragging ? "grabbing" : "grab",
            touchAction: "none",
            userSelect: "none",
            border: "1px solid " + DIM,
          },
        },
        // Four shades around the kept area, so the discarded parts are obvious.
        h("div", {
          style: { position: "absolute", left: 0, right: 0, top: 0, height: topPc + "%", background: shade },
        }),
        h("div", {
          style: {
            position: "absolute",
            left: 0,
            right: 0,
            top: topPc + cropHpc + "%",
            bottom: 0,
            background: shade,
          },
        }),
        h("div", {
          style: {
            position: "absolute",
            left: 0,
            width: leftPc + "%",
            top: topPc + "%",
            height: cropHpc + "%",
            background: shade,
          },
        }),
        h("div", {
          style: {
            position: "absolute",
            left: leftPc + cropWpc + "%",
            right: 0,
            top: topPc + "%",
            height: cropHpc + "%",
            background: shade,
          },
        }),
        h("div", {
          style: {
            position: "absolute",
            left: leftPc + "%",
            top: topPc + "%",
            width: cropWpc + "%",
            height: cropHpc + "%",
            border: "2px solid " + AMBER,
            boxShadow: "0 0 0 1px rgba(255,255,255,0.55) inset",
            pointerEvents: "none",
          },
        })
      );
    },

    render: function () {
      var props = this.props;
      var current = this.value();
      var ratio = parseRatio(props.field);
      var url = "";
      try {
        url = current.src ? String(props.getAsset(current.src) || current.src) : "";
      } catch (err) {
        url = current.src;
      }

      var buttonStyle = {
        font: "inherit",
        fontSize: "13px",
        padding: "6px 12px",
        marginRight: "8px",
        cursor: "pointer",
        border: "1px solid " + INK,
        borderRadius: "3px",
        background: PAPER,
        color: INK,
      };

      return h(
        "div",
        { className: props.classNameWrapper, style: { padding: "10px 12px 14px" } },

        this.state.failed
          ? h(
              "p",
              { style: { color: "#8a2f14", fontSize: "13px", margin: "0 0 8px" } },
              "The picker could not open. Paste an image path below instead."
            )
          : null,

        h(
          "div",
          { style: { marginBottom: "10px" } },
          h(
            "button",
            { type: "button", style: buttonStyle, onClick: this.openLibrary },
            current.src ? "Change photo" : "Choose photo"
          ),
          current.src
            ? h("button", { type: "button", style: buttonStyle, onClick: this.clear }, "Remove")
            : null
        ),

        url
          ? h(
              "div",
              null,
              h("img", {
                src: url,
                alt: "",
                onLoad: this.onImageLoad,
                style: { display: "none" },
              }),
              this.renderFrame(url, ratio),
              h(
                "p",
                { style: { margin: "8px 0 0", fontSize: "12px", color: MUTED, maxWidth: "460px" } },
                "Drag the bright area to choose what stays in the picture. " +
                  "The shaded parts get trimmed off. Arrow keys nudge it."
              ),
              h(
                "p",
                { style: { margin: "4px 0 0", fontSize: "11px", color: MUTED } },
                "Keeping " + current.x + "% across, " + current.y + "% down."
              )
            )
          : h(
              "p",
              { style: { margin: 0, fontSize: "13px", color: MUTED } },
              "No photo chosen yet."
            ),

        // Always available, so a broken picker can never lock an editor out.
        h("input", {
          type: "text",
          value: current.src,
          placeholder: "/images/uploads/example.jpg",
          onChange: function (event) {
            this.commit({ src: event.target.value, x: current.x, y: current.y });
          }.bind(this),
          style: {
            marginTop: "10px",
            width: "100%",
            maxWidth: "460px",
            padding: "6px 8px",
            fontSize: "12px",
            fontFamily: "inherit",
            border: "1px solid " + DIM,
            borderRadius: "3px",
          },
        })
      );
    },
  });

  function Preview(props) {
    var current = normalise(props.value);
    if (!current.src) return null;
    var url = current.src;
    try {
      url = String(props.getAsset(current.src) || current.src);
    } catch (err) {
      /* fall back to the raw path */
    }
    return h("img", {
      src: url,
      alt: "",
      style: {
        width: "100%",
        maxWidth: "320px",
        aspectRatio: "3 / 2",
        objectFit: "cover",
        objectPosition: current.x + "% " + current.y + "%",
      },
    });
  }

  window.CMS.registerWidget("imagefocus", Control, Preview);
})();
