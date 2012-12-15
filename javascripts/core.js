(function(G){

  var Lamp = illuminated.Lamp
    , Lighting = illuminated.Lighting
    , DarkMask = illuminated.DarkMask
    ;

  G.Game = Backbone.Model.extend({

    initialize: function () {
      this.startTime = +new Date();
      this.people = new Backbone.Collection();
    },

    setViewport: function (w, h) {
    },
    
    setPlayer: function (p) {
      this.player = p;
    },

    updateIlluminatedScene: function (ctx, camera) {
      if (this.player && !this.playerLight) {
        this.playerLight = new Lamp({
            distance: 200,
            color: "rgba(233,198,150,0.8)",
            radius: 3,
            samples: 9,
            roughness: 0.9
        });
      }
      if (!this.lighting) {
        this.lighting = new Lighting({
          light: this.playerLight,
          objects: []
        });
      }
      if (!this.darkmask) {
        this.darkmask = new DarkMask({ lights: [this.playerLight] });
      }
      this.playerLight.position = new illuminated.Vec2(
        this.player.get("x"),
        this.player.get("y")
      );
      this.playerLight.angle = this.player.get("angle");
      this.lighting.compute(ctx.canvas.width, ctx.canvas.height);
      this.darkmask.compute(ctx.canvas.width, ctx.canvas.height);
    },

    renderIlluminatedScene: function (ctx, camera) {
      // Update states
      this.updateIlluminatedScene(ctx, camera);
      // Draw
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      this.lighting.render(ctx);
      ctx.globalCompositeOperation = "source-over";
      this.darkmask.render(ctx);
      ctx.restore();
    },

    renderMap: function (ctx, camera) {
      // FIXME
      ctx.fillStyle = "#999";
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    },
    render: function (ctx, camera) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      this.renderMap(ctx, camera);
      this.renderIlluminatedScene(ctx, camera);
      this.people.each(function (people) {
        people.render(ctx, camera);
      });
      this.player && this.player.render(ctx, camera);
    }
  });

  G.Camera = Backbone.Model.extend({
    initialize: function () {
      var self = this;
    },
    setSize: function (w, h) {
      var w = window.innerWidth;
      var h = window.innerHeight;
      this.set("w", w);
      this.set("h", h);
    }
  });

  G.Character = Backbone.Model.extend({
    render: function (ctx, camera) {
      var x = this.get("x");
      var y = this.get("y");
      var angle = this.get("angle");
      var image = this.image();
      var w = image.width;
      var h = image.height;
      var width = this.get("width") || w;
      var height = this.get("height") || h;
      var halfW = Math.round(width/2);
      var halfH = Math.round(height/2);
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y));
      angle && ctx.rotate(-angle);
      ctx.drawImage(image, -halfW, -halfH, width, height);
      ctx.restore();
    },
    image: function () { throw "image() must be implemented"; }
  });

  G.People = G.Character.extend({
    initialize: function () {

    },
    image: function () {
      return G.loader.getResource("people");
    }
  });

  G.Monster = G.Character.extend({
    initialize: function () {
      this.sprites = [
        G.loader.getResource("monster"),
        G.loader.getResource("monster_walk1"),
        G.loader.getResource("monster_walk2")
      ];
      this.lastSpriteTime = +new Date();
      this.lastSprite = 1;
    },
    image: function () {
      var i = 0;
      var now = +new Date();
      if (this.speed) {
        i = this.lastSprite;
        if (now-this.lastSpriteTime > 500/Math.abs(this.speed)) {
          this.lastSprite = i = i==1 ? 2 : 1;
          this.lastSpriteTime = now;
        }
      }
      return this.sprites[i];
    }
  });

  G.KeyboardControls = Backbone.Model.extend({
    initialize: function () {
      this.lastUpdate = +new Date();
      this._down = {};
      var self = this;
      $(window).on("keydown", function (e) {
        self._down[e.keyCode] = true;
      });
      $(window).on("keyup", function (e) {
        self._down[e.keyCode] = false;
      });
    },

    isDown: function (key) {
      return !!this._down[key];
    },

    update: function (entity) {
      var lastUpdate = this.lastUpdate;
      var now = +new Date();
      var t = (now-lastUpdate)/1000;
      var keys = this.get("keys");
      var forward = this.isDown(keys.forward);
      var backward = this.isDown(keys.backward);
      var speed = 0;
      if (forward && !backward) {
        speed = this.get("forwardSpeed")*t;
      }
      else if (backward) {
        speed = -this.get("backwardSpeed")*t;
      }
      var left = this.isDown(keys.turnleft);
      var right = this.isDown(keys.turnright);
      var rotation = 0;
      if (left && !right) {
        rotation = this.get("rotationSpeed")*t;
      }
      else if (right) {
        rotation = -this.get("rotationSpeed")*t;
      }

      var angle = entity.get("angle");
      var x = entity.get("x") + Math.cos(-angle)*speed;
      var y = entity.get("y") + Math.sin(-angle)*speed;
      angle += rotation;

      entity.speed = speed;
      entity.set("x", x);
      entity.set("y", y);
      entity.set("angle", angle);
      this.lastUpdate = now;
    }
  });

}(window.game));
