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
    var w = this.get("width"), h = this.get("height");
    this.floorTexture = createCanvas(w, h);
    perlinNoise(this.floorTexture);
  }
});

  G.Game = Backbone.Model.extend({

    initialize: function () {
      this.startTime = +new Date();
      this.people = new Backbone.Collection();
      this.map = new G.Map({
        width: 2000,
        height: 2000
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
      this.playerLight.distance = 1.5*this.player.get("tongueDistance");
      this.playerLight.angle = this.player.get("angle");
      this.lighting.compute(ctx.canvas.width, ctx.canvas.height);
      this.darkmask.compute(ctx.canvas.width, ctx.canvas.height);
    },

    renderLights: function (ctx, camera) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      this.lighting.render(ctx);
      ctx.restore();
    },
    
    renderFog: function (ctx, camera) {
      ctx.save();
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
      this.updateIlluminatedScene(ctx, camera);
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      this.renderFloor(ctx, camera);
      this.renderLights(ctx, camera);
      this.people.each(function (people) {
        people.render(ctx, camera);
      });
      this.player && this.player.render(ctx, camera);
      this.renderFog(ctx, camera);
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
    initialize: function () {
      this.x = this.get("x");
      this.y = this.get("y");
      this.width = this.get("width");
      this.height = this.get("height");
    },
    render: function (ctx, camera) {
      var angle = this.get("angle");
      var sprite = this.sprite();
      var image = sprite.image;
      var w = this.width||image.width;
      var h = this.height||image.height;
      var halfW = Math.round(w/2);
      var halfH = Math.round(h/2);
      var spritex = sprite.x||0;
      var spritey = sprite.y||0;
      var spritew = sprite.w||image.width;
      var spriteh = sprite.h||image.height;
      ctx.save();
      ctx.translate(Math.round(this.x), Math.round(this.y));
      angle && ctx.rotate(-angle);
      ctx.drawImage(image, 
        spritex, spritey, spritew, spriteh,
        -halfW, -halfH, w, h);
      ctx.restore();
    },
    sprite: function () { throw ".sprite() is not implemented" }
  });

  G.People = G.Character.extend({
    initialize: function () {
      G.Character.prototype.initialize.apply(this, arguments);
      this.sex = this.get("sex")=="f" ? "f" : "m";
      this.model = this.get("model") || 0;
      this.lastSpriteTime = +new Date();
      this.lastSprite = 1;
      this.speed = 200;
    },
    setAI: function (ai) {
      this.ai = ai;
    },
    update: function () {
      this.ai && this.ai.update(this);
    },
    isRunning: function () {
      return this.ai && this.ai.running;
    },
    sprite: function () {
      var i = 0;
      var now = +new Date();
      if (this.speed) {
        i = this.lastSprite;
        var t = ((now-this.lastSpriteTime)/1000)*(Math.abs(this.speed)/80);
        if (t>1) this.lastSpriteTime = now;
        else {
          if (this.isRunning()) {
            this.lastSprite = t<0.5 ? 1 : 2;
          }
          else {
            if (t<0.4) {
              this.lastSprite = 1;
            }
            else if (t<0.6) {
              this.lastSprite = 0;
            }
            else if (t<1.0) {
              this.lastSprite = 2;
            }
          }
        }
      }
      var image = G.loader.getResource("people_"+this.sex, 3*this.width, 4*this.height);
      var W = image.width/3;
      var H = image.height/4;
      return {
        image: image,
        x: Math.round(i*W),
        y: Math.round(this.model*H),
        w: Math.round(W),
        h: Math.round(H)
      };
    }
  });

  G.Monster = G.Character.extend({
    initialize: function () {
      G.Character.prototype.initialize.apply(this, arguments);
      this.sprites = [
        "monster",
        "monster_walk1",
        "monster_walk2"
      ];
      this.lastSpriteTime = +new Date();
      this.lastSprite = 1;
      this.tongue = 0; /* from 0 to 1 */
      this.tongueSpeedOut = 10;
      this.tongueSpeedIn = 10;
    },
    sprite: function () {
      var i = 0;
      var now = +new Date();
      if (this.speed) {
        i = this.lastSprite;
        if (now-this.lastSpriteTime > 50000/Math.abs(this.speed)) {
          this.lastSprite = i = i==1 ? 2 : 1;
          this.lastSpriteTime = now;
        }
      }
      var imageId = this.sprites[i];
      return {
        image: G.loader.getResource(imageId, this.width, this.height)
      };
    },
    tongueOut: function (duration) {
      this.tongueAnimation = 1;
      this.tongueDuration = duration;
      this.tongueDate = +new Date();
    },
    tongueIn: function (duration) {
      this.tongueAnimation = -1;
      this.tongueDuration = duration;
      this.tongueDate = +new Date();
    },
    render: function (ctx, camera) {
      if (this.tongueAnimation) {
        var now = +new Date();
        var t = (now-this.tongueDate)/1000;
        this.tongueDate = now;
        this.tongue = G.clamp(0, 1, this.tongue+t*this.tongueDuration*this.tongueAnimation);
      }
      // Render the tongue
      if (this.tongue) {
        var width = this.width;

        var TONGUE_X = Math.round(width/5), 
            TONGUE_Y = Math.round(width/80),
            TONGUE_W = Math.round(width/6);
        var tongueLength = this.get("tongueDistance") - TONGUE_X;
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

  G.Controls = Backbone.Model.extend({
    speed: function(entity) { return 0 },
    angle: function(entity) { return 0 },
    update: function (entity) {
      var now = +new Date();
      if (!this.lastUpdate) this.lastUpdate=now;
      var t = (now-this.lastUpdate)/1000;
      var angle = this.angle(entity);
      var speed = this.speed(entity);
      entity.speed = speed;
      entity.x = entity.x + Math.cos(-angle)*speed*t;
      entity.y = entity.y + Math.sin(-angle)*speed*t;
      entity.set("angle", angle);
      this.lastUpdate = now;
    }
  });

  G.PeopleAI = G.Controls.extend({
    initialize: function () {
      this.stopped = false;
      this.running = false;
      this.runFactor = 2;
      this.visibility = 250;
      this.decisionInterval = 2000;
      this.lastDecision = +new Date();
      this.a = 0;
      this.opponents = new Backbone.Collection();
    },
    checkDanger: function (entity) {
      if (this.opponents.size()==0) return;
      var self = this;
      var closest = 
        this.opponents
          .map(function (opponent) {
            var x = entity.x-opponent.x;
            var y = entity.y-opponent.y;
            var d = Math.sqrt(x*x+y*y);
            return [ d, opponent ];
          })
          .filter(function (o) {
            return o[0]<self.visibility;
          })
          .sort(function (a, b) {
            return a[0]-b[0];
          })[0];
      if (!closest) return;
      return {
        distance: closest[0],
        entity: closest[1]
      }
    },
    decide: function (entity) {
      var danger = this.checkDanger(entity);
      if (danger) {
        this.stopped = false;
        this.running = true;
        this.a = -Math.PI/2+Math.atan2(
          entity.x-danger.entity.x,
          entity.y-danger.entity.y
        );
      }
      else {
        this.stopped = Math.random()<0.3;
        this.a = 2*Math.PI*Math.random();
      }
    },
    update: function (entity) {
      var now = +new Date();
      if (now-this.lastDecision>this.decisionInterval) {
        this.lastDecision = now;
        this.decide(entity);
      }
      G.Controls.prototype.update.apply(this, arguments);
    },
    speed: function (entity) {
      if (this.stopped) return 0;
      var speed = this.get("speed");
      if (this.running)
        speed *= this.runFactor;
      return speed;
    },
    angle: function (entity) {
      return this.a;
    }
  });

  G.PlayerControls = G.Controls.extend({
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
    speed: function (entity) {
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
      if (pointer) {
        var d = this.distanceWithPointer(entity);
        speed *= G.smoothstep(30, 150, d);
      }
      return speed;
    },
    angle: function (entity) {
      var pointer = this.get("pointer");
      if (pointer) {
        var now = +new Date();
        if (!this.angleTargetTime) this.angleTargetTime=now;
        var t = ((now-this.angleTargetTime)/1000);
        this.angleTarget = Math.PI/2+Math.atan2(entity.x-pointer.x, entity.y-pointer.y);
        var angle = entity.get("angle");
        var diff = this.angleTarget-angle;
        if (diff < -Math.PI) diff += 2*Math.PI;
        if (diff > Math.PI) diff -= 2*Math.PI;
        angle += diff*t*(this.get("rotationSpeed")||1);
        entity.set("angle", angle);
        this.angleTargetTime = now;
      }
      return entity.get("angle");
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
    }
  });

}(window.game));
