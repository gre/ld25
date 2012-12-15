(function(G){

  var Lamp = illuminated.Lamp
    , Lighting = illuminated.Lighting
    , DarkMask = illuminated.DarkMask
    ;

function createCanvas (w, h) {
  var c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function randomNoise(canvas, x, y, width, height, alpha) {
    x = x || 0;
    y = y || 0;
    width = width || canvas.width;
    height = height || canvas.height;
    alpha = alpha || 255;
    var g = canvas.getContext("2d"),
        imageData = g.getImageData(x, y, width, height),
        random = Math.random,
        pixels = imageData.data,
        n = pixels.length,
        i = 0;
    while (i < n) {
        pixels[i++] = pixels[i++] = pixels[i++] = (random() * 256) | 0;
        pixels[i++] = alpha;
    }
    g.putImageData(imageData, x, y);
    return canvas;
}
 
function perlinNoise(canvas, noise) {
    noise = noise || randomNoise(createCanvas(canvas.width, canvas.height));
    var g = canvas.getContext("2d");
    g.save();
    
    /* Scale random iterations onto the canvas to generate Perlin noise. */
    for (var size = 4; size <= noise.width; size *= 2) {
        var x = (Math.random() * (noise.width - size)) | 0,
            y = (Math.random() * (noise.height - size)) | 0;
        g.globalAlpha = 4 / size;
        g.drawImage(noise, x, y, size, size, 0, 0, canvas.width, canvas.height);
    }
 
    g.restore();
    return canvas;
}

G.Map = Backbone.Model.extend({
  initialize: function () {
    var w = this.get("w"), h = this.get("h");
    this.floorTexture = createCanvas(w, h);
    perlinNoise(this.floorTexture);
  }
});

  G.Game = Backbone.Model.extend({

    initialize: function () {
      this.startTime = +new Date();
      this.people = new Backbone.Collection();
      this.map = new G.Map({
        w: 2000,
        h: 2000
      });
    },

    setViewport: function (w, h) {
    },
    
    setPlayer: function (p) {
      this.player = p;
    },

    updateIlluminatedScene: function (ctx, camera) {
      if (this.player && !this.playerLight) {
        this.playerLight = new Lamp({
            distance: 300,
            color: "rgba(240,220,180,0.9)",
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
        this.player.x,
        this.player.y
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

    renderFloor: function (ctx, camera) {
      ctx.save();
      ctx.fillStyle = "#857d74";
      ctx.globalCompositeOperation = "darker";
      ctx.drawImage(this.map.floorTexture, 0, 0);
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();
    },
    render: function (ctx, camera) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      this.renderFloor(ctx, camera);
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
      var x = this.x;
      var y = this.y;
      var angle = this.get("angle");
      var image = this.image();
      var w = image.width;
      var h = image.height;
      var halfW = Math.round(w/2);
      var halfH = Math.round(h/2);
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y));
      angle && ctx.rotate(-angle);
      ctx.drawImage(image, -halfW, -halfH);
      ctx.restore();
    },
    image: function () {
      return G.loader.getResource(this.imageId(), this.get("width"), this.get("height"));
    }
  });

  G.People = G.Character.extend({
    initialize: function () {
      this.x = this.get("x");
      this.y = this.get("y");
    },
    imageId: function () {
      return "people";
    }
  });

  G.Monster = G.Character.extend({
    initialize: function () {
      this.x = this.get("x");
      this.y = this.get("y");
      this.sprites = [
        "monster",
        "monster_walk1",
        "monster_walk2"
      ];
      this.lastSpriteTime = +new Date();
      this.lastSprite = 1;
      this.tongue = 0; /* from 0 to 1 */
      this.tongueDistance = 200;
    },
    imageId: function () {
      var i = 0;
      var now = +new Date();
      if (this.speed) {
        i = this.lastSprite;
        if (now-this.lastSpriteTime > 50000/Math.abs(this.speed)) {
          this.lastSprite = i = i==1 ? 2 : 1;
          this.lastSpriteTime = now;
        }
      }
      return this.sprites[i];
    },
    render: function (ctx, camera) {
      // Render the tongue
      if (this.tongue) {
        var width = this.get("width");

        var TONGUE_X = Math.round(width/5), 
            TONGUE_Y = Math.round(width/80),
            TONGUE_W = Math.round(width/6);
        var tongueLength = this.tongueDistance - TONGUE_X;
        var length = Math.round(this.tongue*tongueLength);
        var angle = this.get("angle");
        ctx.save();
        ctx.strokeStyle = "#d31744";
        ctx.lineWidth = TONGUE_W;
        ctx.lineCap = "round";
        ctx.translate(this.x, this.y);
        ctx.rotate(-angle);
        ctx.beginPath();
        ctx.moveTo(TONGUE_X, TONGUE_Y);
        ctx.lineTo(TONGUE_X+length, TONGUE_Y);
        ctx.stroke();
        ctx.closePath();
        ctx.restore();
      }
      // Render the monster
      G.Character.prototype.render.apply(this, arguments);
    }
  });

  G.PlayerControls = Backbone.Model.extend({
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
      $(window).on("mousemove", function (e) {
        self.set("pointer", { x: e.clientX, y: e.clientY });
      });
    },

    isDown: function (key) {
      return !!this._down[key];
    },

    distanceWithPointer: function (entity) {
      var pointer = this.get("pointer");
      if (!pointer) return Infinity;
      var x = entity.x-pointer.x;
      var y = entity.y-pointer.y;
      return Math.sqrt(x*x+y*y);
    },

    update: function (entity) {
      var now = +new Date();
      var t = (now-this.lastUpdate)/1000;
      var keys = this.get("keys");
      var forward = this.isDown(keys.forward);
      var backward = this.isDown(keys.backward);
      var speed = 0;
      if (forward && !backward) {
        speed = this.get("forwardSpeed");
      }
      else if (backward) {
        speed = -this.get("backwardSpeed");
      }
      var pointer = this.get("pointer");

      var angle = entity.get("angle");
      if (pointer) {
        angle = Math.PI/2+Math.atan2(entity.x-pointer.x, entity.y-pointer.y);
        var d = this.distanceWithPointer(entity);
        speed *= G.smoothstep(30, 150, d);
      }

      entity.speed = speed;
      entity.x = entity.x + Math.cos(-angle)*speed*t;
      entity.y = entity.y + Math.sin(-angle)*speed*t;
      entity.set("angle", angle);
      this.lastUpdate = now;
    }
  });

}(window.game));
