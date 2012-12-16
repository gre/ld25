(function (G) {

  // TODO stop method

  G.Timeline = function () {
    this.updates = [];
    this.updatesArguments = [];
    this.instants = [];

    this.ends = [];
  }

  G.Timeline.prototype._onend = function () {
    for (var i=0; i<this.ends.length; ++i)
      this.ends[i]();
  }
  
  G.Timeline.prototype.end = function (cb) {
    this.ends.push(cb);
  }

  G.Timeline.prototype.start = function () {
    this.start = +new Date();
    return this;
  }

  G.Timeline.prototype.time = function () {
    if (!this.start) return 0;
    return +new Date() - this.start;
  }

  G.Timeline.prototype.update = function () {
    if (this.hasEnd) return;
    var i = 0;
    while (i<this.instants.length) {
      var instant = this.instants[i];
      var now = this.time();
      if (instant.t>now) break;
      if (instant.t<now) {
        instant.f.call(this);
        this.instants.splice(i, 1);
      }
      else {
        ++i;
      }
    }

    for (var i=0; i<this.updates.length; ++i)
      this.updates[i].apply(this, this.updatesArguments[i].call(this));
    if (this.instants.length==0 && this.updates.length==0) {
      this._onend();
      this.hasEnd=true;
    }
  }

  G.Timeline.prototype._addInstant = function (i) {
    this.instants.push(i);
    this.instants.sort(function (a, b) {
      return a.t - b.t;
    });
  }

  G.Timeline.prototype.between = function (after, before, callbacks) {
    var loop = callbacks.loop;
    this._addInstant({
      t: after,
      f: function () {
        if (loop) {
          this.updates.push(loop);
          this.updatesArguments.push(function(){
            var t = this.time();
            var p = G.smoothstep(after, before, t);
            return [ t, p ];
          });
        }
        callbacks.start && callbacks.start.apply(this, arguments);
      }
    });
    if (before !== Infinity) {
      this._addInstant({
        t: before,
        f:  function () {
          if (loop) {
            var i = this.updates.indexOf(loop);
            if (i!==-1) {
              this.updates.splice(i, 1);
              this.updatesArguments.splice(i, 1);
            }
          }
          callbacks.stop && callbacks.stop.apply(this, arguments);
        }
      });
    }
    return this;
  }
    
  G.Timeline.prototype.once = function (t, f) {
    this._addInstant({
      t: t,
      f: f
    });
    return this;
  }

  G.Timeline.prototype.before = function (before, callbacks) {
    this.between(0, before, callbacks);
    return this;
  }
  
  G.Timeline.prototype.after = function (after, callbacks) {
    this.between(after, +Infinity, callbacks);
    return this;
  }

  G.Timeline.prototype.always = function (callbacks) {
    this.between(0, +Infinity, callbacks);
    return this;
  }

}(window.game));
