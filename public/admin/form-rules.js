/*
  Two widgets that make the page form react to itself, which Decap cannot do on
  its own: it has no conditional fields.

    linkmode  the tick that turns a page into a plain link to another website.
              Hides the fields a link has no use for.
    navplace  the "where this page appears in the menus" chooser. Hides "Sits
              under" when the small top bar is chosen, because that bar is a
              flat row with no drop-downs.

  Both hide neighbouring fields from their own DOM node, matching on the start
  of each field's label. Nothing is moved or reordered, only shown and hidden,
  and the work is redone on every render and whenever Decap rebuilds the form.
  If the structure is not recognised they do nothing at all, which just leaves
  the extra fields visible. Everything still saves, and the site does not rely
  on any of this: src/lib/navigation.ts ignores a parent on a top bar page
  whether or not the field was ever hidden.

  Written against window.h and window.createClass, which Decap exposes, so
  there is no build step here.
*/

(function () {
  var h = window.h;
  var createClass = window.createClass;
  if (!h || !createClass || !window.CMS) return;

  var AMBER = "#c8791f";
  var MUTED = "#55605a";

  // Matched against the start of each field's label, so a trailing asterisk or
  // hint does not matter. These are the fields a link cannot use. Menu
  // placement stays visible, otherwise the link could not be put on a bar.
  var LINK_HIDES = [
    "Search engine summary",
    "Banner photo",
    "Banner photo description",
    "Page content",
  ];

  var PARENT_FIELD = ["Sits under"];

  function labelOf(el) {
    var label = el.querySelector ? el.querySelector("label") : null;
    return label ? (label.textContent || "").trim() : "";
  }

  function matches(text, labels) {
    for (var i = 0; i < labels.length; i++) {
      if (text.indexOf(labels[i]) === 0) return true;
    }
    return false;
  }

  // Climbs to the element holding the list of fields, identified by having
  // several labelled children rather than by any class name, since Decap's
  // class names are generated and change between releases.
  function fieldList(node) {
    var el = node;
    for (var i = 0; i < 12 && el && el.parentElement; i++) {
      var parent = el.parentElement;
      var labelled = 0;
      for (var j = 0; j < parent.children.length; j++) {
        if (labelOf(parent.children[j])) labelled++;
      }
      if (labelled >= 3) return parent;
      el = parent;
    }
    return null;
  }

  function apply(node, labels, on) {
    if (!node) return null;
    var list = fieldList(node);
    if (!list) return null;
    for (var i = 0; i < list.children.length; i++) {
      var child = list.children[i];
      if (!matches(labelOf(child), labels)) continue;
      child.style.display = on ? "none" : "";
    }
    return list;
  }

  var Control = createClass({
    componentDidMount: function () {
      this.sync();
      // Decap re-renders the form as fields change. Reapplying on any change
      // to the field list is what stops the hiding coming undone.
      var self = this;
      if (window.MutationObserver && this.list) {
        this.observer = new window.MutationObserver(function () {
          self.sync();
        });
        this.observer.observe(this.list, { childList: true });
      }
    },

    componentDidUpdate: function () {
      this.sync();
    },

    componentWillUnmount: function () {
      if (this.observer) this.observer.disconnect();
      // Leave the form as it was found, so switching to another entry does not
      // inherit hidden fields.
      apply(this.node, LINK_HIDES, false);
    },

    sync: function () {
      this.list = apply(this.node, LINK_HIDES, this.props.value === true);
    },

    handleChange: function (event) {
      this.props.onChange(event.target.checked);
    },

    render: function () {
      var self = this;
      var on = this.props.value === true;

      return h(
        "div",
        {
          ref: function (n) {
            self.node = n;
          },
          style: { padding: "2px 0" },
        },
        h(
          "label",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
              fontSize: "14px",
            },
          },
          h("input", {
            type: "checkbox",
            checked: on,
            onChange: this.handleChange,
            style: { width: "18px", height: "18px", accentColor: AMBER, cursor: "pointer" },
          }),
          h(
            "span",
            null,
            on
              ? "This page is a link. Fill in the web address below."
              : "Make this a link to another website"
          )
        ),
        on
          ? h(
              "p",
              { style: { margin: "6px 0 0", fontSize: "13px", color: MUTED } },
              "No page will be made. The menu entry goes straight to the address below."
            )
          : null
      );
    },
  });

  var Preview = createClass({
    render: function () {
      return h("span", null, this.props.value === true ? "Link to another website" : "");
    },
  });

  window.CMS.registerWidget("linkmode", Control, Preview);

  // The small top bar is a flat row, so a page on it cannot sit inside a
  // drop-down. Rendering the chooser here rather than using the stock select
  // means its value is known directly, instead of being read back out of
  // Decap's own markup.
  function optionsOf(field) {
    var raw = field && field.get ? field.get("options") : null;
    if (!raw) return [];
    var list = raw.toJS ? raw.toJS() : raw;
    return list.map(function (option) {
      return typeof option === "string"
        ? { label: option, value: option }
        : { label: option.label, value: option.value };
    });
  }

  var NavPlace = createClass({
    componentDidMount: function () {
      this.sync();
      var self = this;
      if (window.MutationObserver && this.list) {
        this.observer = new window.MutationObserver(function () {
          self.sync();
        });
        this.observer.observe(this.list, { childList: true });
      }
    },

    componentDidUpdate: function () {
      this.sync();
    },

    componentWillUnmount: function () {
      if (this.observer) this.observer.disconnect();
      apply(this.node, PARENT_FIELD, false);
    },

    sync: function () {
      this.list = apply(this.node, PARENT_FIELD, this.props.value === "utility");
    },

    handleChange: function (event) {
      this.props.onChange(event.target.value);
    },

    render: function () {
      var self = this;
      var options = optionsOf(this.props.field);
      var value = this.props.value || (options[0] && options[0].value) || "";

      return h(
        "div",
        {
          ref: function (n) {
            self.node = n;
          },
        },
        h(
          "select",
          {
            value: value,
            onChange: this.handleChange,
            style: {
              width: "100%",
              padding: "10px 12px",
              fontSize: "15px",
              fontFamily: "inherit",
              border: 0,
              borderRadius: "3px",
              background: "transparent",
              cursor: "pointer",
            },
          },
          options.map(function (option) {
            return h("option", { key: option.value, value: option.value }, option.label);
          })
        ),
        value === "utility"
          ? h(
              "p",
              { style: { margin: "6px 0 0", fontSize: "13px", color: MUTED } },
              "The small top bar is a single row, so pages on it cannot sit inside a drop-down."
            )
          : null
      );
    },
  });

  var NavPlacePreview = createClass({
    render: function () {
      return h("span", null, this.props.value || "");
    },
  });

  window.CMS.registerWidget("navplace", NavPlace, NavPlacePreview);
})();
