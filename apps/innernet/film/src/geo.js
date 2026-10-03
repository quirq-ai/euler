// Path geometry for the runtime's draw-on (src/runtime.js). Read once, synchronously, while
// the timeline is built; never from a timeline callback.
window.FILM_GEO = {
  meas: null,
  /** Length of a path's d, in user units (0 when it cannot be measured). */
  len(d) {
    if (!this.meas) {
      const NS = "http://www.w3.org/2000/svg";
      const host = document.createElementNS(NS, "svg");
      host.setAttribute("width", "0");
      host.setAttribute("height", "0");
      host.style.position = "absolute";
      this.meas = document.createElementNS(NS, "path");
      host.appendChild(this.meas);
      document.body.appendChild(host);
    }
    this.meas.setAttribute("d", d);
    try {
      return this.meas.getTotalLength();
    } catch (_) {
      return 0;
    }
  },
};
