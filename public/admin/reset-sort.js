/*
  One-time clearing of a saved sort preference.

  Decap remembers how each list was last sorted, in IndexedDB under
  decap-cms.entries.sort, and that memory wins over the default_sort set in
  config.yml. Anyone who sorted the news list before the default was configured
  keeps the old order forever, which looked like the setting being ignored.

  This clears that one key once per browser and reloads, so the configured
  default applies. Sorting afterwards is remembered as normal.

  Loaded before the CMS bundle so the reload happens before Decap reads state.
*/

(function () {
  var FLAG = "pt-sort-reset-v1";
  var KEY = "decap-cms.entries.sort";

  try {
    if (localStorage.getItem(FLAG)) return;
    localStorage.setItem(FLAG, "1");
  } catch (err) {
    return;
  }

  // localforage's default database and store.
  var open = indexedDB.open("localforage");

  open.onsuccess = function () {
    var db = open.result;
    if (!db.objectStoreNames.contains("keyvaluepairs")) {
      db.close();
      return;
    }
    var tx = db.transaction("keyvaluepairs", "readwrite");
    tx.objectStore("keyvaluepairs").delete(KEY);
    tx.oncomplete = function () {
      db.close();
      window.location.reload();
    };
    tx.onerror = function () {
      db.close();
    };
  };

  open.onerror = function () {
    /* no saved state to clear */
  };
})();
