(function(G){

  var b2Vec2 = Box2D.Common.Math.b2Vec2
    , b2PolygonShape = Box2D.Collision.Shapes.b2PolygonShape
    ;

  var Lamp = illuminated.Lamp
    , Lighting = illuminated.Lighting
    , DarkMask = illuminated.DarkMask
    ;

b2Vec2.prototype.toIlluminated = function () {
  return new illuminated.Vec2(this.x, this.y);
}

function createCanvas (w, h) {
  var c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function randomNoise(canvas, x, y, width, height, alpha, getRandomColor) {
    x = x || 0;
    y = y || 0;
    width = width || canvas.width;
    height = height || canvas.height;
    alpha = alpha || 255;
    getRandomColor = getRandomColor || function () {
        var r = (Math.random() * 256) | 0;
        return [ r, r, r ];
    };
    var g = canvas.getContext("2d"),
        imageData = g.getImageData(x, y, width, height),
        pixels = imageData.data,
        n = pixels.length,
        i = 0;
    while (i < n) {
        var color = getRandomColor();
        for (var c=0; c<3; ++c)
          pixels[i++] = color[c];
        pixels[i++] = alpha;
    }
    g.putImageData(imageData, x, y);
    return canvas;
}
 
function perlinNoise(canvas, force, noise) {
    noise = noise || randomNoise(createCanvas(canvas.width, canvas.height));
    var g = canvas.getContext("2d");
    g.save();
    
    /* Scale random iterations onto the canvas to generate Perlin noise. */
    for (var size = 4; size <= noise.width; size *= 2) {
        var x = (Math.random() * (noise.width - size)) | 0,
            y = (Math.random() * (noise.height - size)) | 0;
        g.globalAlpha = force / size;
        g.drawImage(noise, x, y, size, size, 0, 0, canvas.width, canvas.height);
    }
 
    g.restore();
    return canvas;
}

G.Building = Backbone.Model.extend({
  getSize: function () {
    return {
      width: this.get("width"),
      height: this.get("height")
    }
  },
  getOpaqueObject: function (camera) {
    var p = camera.realPositionToCanvas(this.getPosition());
    var size = this.getSize();
    var topleft = new illuminated.Vec2(p.x, p.y);
    var bottomright = new illuminated.Vec2(p.x+size.width, p.y+size.height);

    return new illuminated.RectangleObject({ 
      topleft: topleft,
      bottomright: bottomright
    });
  },
  getPosition: function () {
    return {
      x: this.get("x"),
      y: this.get("y")
    }
  }
})

G.Map = Backbone.Model.extend({
  initialize: function () {
    var w = this.get("width"), h = this.get("height");
    this.floorTexture = createCanvas(w, h);
    this.buildingsTexture = createCanvas(w, h);
    this.buildings = new Backbone.Collection();
  },

  addBuilding: function (b) {
    this.buildings.push(b);
  },

  findRandomPlace: function (size) {
    size = size || 0;
    var pos = {};
    do {
      pos.x = (0.1+0.8*Math.random()) * this.get("width");
      pos.y = (0.1+0.8*Math.random()) * this.get("height");
    }
    while (!this.validPosition(pos, size/3));
    return pos;
  },

  compute: function () {
    this.computeFloor();
    this.computeBuildings();
  },

  computeFloor: function () {
    var w = this.get("width"), h = this.get("height");
    var ctx = this.floorTexture.getContext("2d");

    ctx.save();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = "#234";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    var road = createCanvas(w, h);
    perlinNoise(road, 1000, randomNoise(createCanvas(w, h), 0, 0, w, h, 5));
    ctx.drawImage(road, 0, 0);

    var n2 = createCanvas(w, h);
    perlinNoise(n2, 0.8, randomNoise(createCanvas(w, h), 0, 0, w, h, 100, function () {
      var r = Math.random()*256;
      var g = Math.random()*256;
      var b = Math.random()*256;
      return [r,g,b];
    }));
    ctx.drawImage(n2, 0, 0);
    ctx.restore();
  },

  computeBuildings: function () {
    var w = this.get("width"), h = this.get("height");
    var ctx = this.buildingsTexture.getContext("2d");

    var buildingTexture = createCanvas(w, h);
    perlinNoise(buildingTexture, 2000, randomNoise(createCanvas(w, h), 0, 0, w, h, 255, function () {
      var v = Math.random()*50;
      return [v,v,v];
    }));

    ctx.save();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.beginPath();
    this.buildings.each(function (building) {
      var pos = building.getPosition();
      var size = building.getSize();
      ctx.rect(pos.x, pos.y, size.width, size.height);
    });
    ctx.clip();
    ctx.drawImage(buildingTexture, 0, 0);
    ctx.restore();
  },
  
  validPosition: function (p, radius) {
    radius = radius || 0;
    if (p.x<radius || this.get("width")-radius<p.x
     || p.y<radius || this.get("height")-radius<p.y) return false;
    var noCollisionsWithBuilding = 
      this.buildings.every(function (building) {
        var pos = building.getPosition();
        var size = building.getSize();
        if (pos.x-radius < p.x && p.x <pos.x+size.width+radius
         && pos.y-radius < p.y && p.y <pos.y+size.height+radius)
          return false;
        return true;
      });
    return noCollisionsWithBuilding;
  }
});

  G.Game = Backbone.Model.extend({

    initialize: function () {
      this.startTime = +new Date();
      this.people = new Backbone.Collection();
      
      this.playerLight = new Lamp({
        color: "rgba(220,180,120,0.9)",
        radius: 0,
        samples: 1,
        roughness: 0.9
      });

      this.lighting = new Lighting({
        light: this.playerLight,
        objects: []
      });

      this.darkmask = new DarkMask({ 
        lights: [ this.playerLight ] 
      });

      this.withLights = true;

      this.peopleOpponents = new Backbone.Collection();
    },

    setMap: function (map) {
      this.map = map;
    },
    
    setPlayer: function (p) {
      this.player = p;
    },

    addRandomPeople: function () {
      var size = Math.round(75 + 10*Math.random());
      var pos = this.map.findRandomPlace(size);

      var people = new G.People({
        x: pos.x,
        y: pos.y,
        angle: 2*Math.PI*Math.random(),
        speed: size+Math.round((size/2)*Math.random()),
        width: size,
        height: size,
        sex: Math.random()>.5 ? "m" : "f",
        model: Math.floor(Math.random()*4)
      });

      var ai = new G.PeopleAI({
        reactionTime: 700+Math.round(1000*Math.random())
      });
      // FIXME TODO: give the AI a way to check if there are collisions 
      // + out of bounds : functions?
      people.setAI(ai);

      people.ai.opponents = this.peopleOpponents;
      this.people.push(people);
    },

    makePeopleAwareOfPlayer: function (player) {
      this.peopleOpponents.push(player);
      var self = this;
      this.people.each(function (people) {
        people.ai.opponents = self.peopleOpponents;
        people.ai.decide(people);
      });
    },

    updateIlluminatedScene: function (ctx, camera) {
      var p = camera.realPositionToCanvas(this.player.getPosition());
      var scale = camera.get("scale");
      this.playerLight.position = new illuminated.Vec2(
        p.x,
        p.y
      );
      this.playerLight.distance = 1.8*this.player.get("tongueDistance")/scale;
      this.playerLight.angle = this.player.get("angle");
      // Generate opaque objects
      var lighting = this.lighting;
      lighting.objects = [];
      this.map.buildings.each(function (building) {
        lighting.objects.push(building.getOpaqueObject(camera));
      });
      this.people.each(function (people) {
        if (!people.isCaught())
          lighting.objects.push(people.getOpaqueObject(camera));
      });
      lighting.compute(ctx.canvas.width, ctx.canvas.height);
      // 
      this.darkmask.compute(ctx.canvas.width, ctx.canvas.height);
    },

    updatePeople: function () {
      var now = +new Date();
      if (!this.lastPeopleAdd) this.lastPeopleAdd = now;
      if (now-this.lastPeopleAdd > 1000) {
        this.lastPeopleAdd = now;
        if (this.people.size() < this.get("maxPeople")) {
          this.addRandomPeople();
        }
      }
    },

    update: function () {
      var self = this;
      this.updatePeople();
      this.people.each(function (people) {
        people.update();
        if (!people.isCaught() && self.player.tongueCollide(people)) {
          self.player.onTongueCatch(people);
        }
      });
      this.player && this.player.update();
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
      camera.translateContext(ctx);
      ctx.drawImage(this.map.floorTexture, 0, 0);
      ctx.restore();
    },

    renderBuildings: function (ctx, camera) {
      ctx.save();
      camera.translateContext(ctx);
      ctx.drawImage(this.map.buildingsTexture, 0, 0);
      ctx.restore();
    },

    render: function (ctx, camera) {
      this.updateIlluminatedScene(ctx, camera);
      ctx.save();
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      this.renderFloor(ctx, camera);
      this.withLights && this.renderLights(ctx, camera);
      this.people.each(function (people) {
        if (!people.isCaught())
          people.render(ctx, camera);
      });
      this.player && this.player.render(ctx, camera);
      this.people.each(function (people) {
        if (people.isCaught())
          people.render(ctx, camera);
      });
      this.renderBuildings(ctx, camera);
      this.renderFog(ctx, camera);
      ctx.restore();
    }
  });

  // Inspired from https://github.com/gre/blazing-race/blob/master/js/game/Camera.js
  G.Camera = Backbone.Model.extend({
    initialize: function () {
      var self = this;
      this.shaking = 0;
      this.shakingInterval = 80;
    },
    resize: function (w, h) {
      var w = window.innerWidth;
      var h = window.innerHeight;
      this.set("w", w);
      this.set("h", h);
    },
    shake: function () {
      var now = +new Date();
      var last = this.lastShake || 0;
      if (now-last > this.shakingInterval) {
        this.lastShake = now;
        this.shakex = this.shaking*(2*Math.random()-1);
        this.shakey = this.shaking*(2*Math.random()-1);
      }
    },

    getShape: function () {
      var topleft = this.canvasToRealPosition(new b2Vec2(0,0));
      var bottomright = this.canvasToRealPosition(new b2Vec2(this.get("w"),this.get("h")));
      return b2PolygonShape.AsOrientedBox(
        bottomright.x-topleft.x, 
        topleft.y-bottomright.y, 
        new b2Vec2(
          (topleft.x+bottomright.x)/2, 
          (topleft.y+bottomright.y)/2
        ));
    },

    setWorldSize: function (w, h) {
      this.worldwidth = w;
      this.worldheight = h;
    },

    setScale: function (s) {
      this.set("scale", s);
    },

    getPosition: function () {
      return new b2Vec2(
        this.get("x")+(this.shaking && this.shakex || 0), 
        this.get("y")+(this.shaking && this.shakey || 0)
      );
    },
    
    canvasToRealPosition: function (p) {
      var scale = this.get("scale");
      var height = this.get("h");
      var pos = this.getPosition();
      return new b2Vec2(
        (-pos.x + p.x)/scale,
        (-pos.y + p.y)/scale
      )
    },

    realPositionToCanvas: function (p) {
      var pos = this.getPosition();
      var scale = this.get("scale");
      var height = this.get("h");
      return new b2Vec2(
        Math.round(pos.x + scale*p.x),
        Math.round(pos.y + scale*p.y)
      )
    },

    translateContext: function (ctx) {
      var pos = this.getPosition();
      var scale = this.get("scale");
      var height = this.get("h");
      ctx.translate(pos.x, pos.y);
    },

    translateContextWithParallax: function (ctx, x, y) {
      var pos = this.getPosition();
      var scale = this.get("scale");
      var height = this.get("h");
      ctx.translate(
        Math.round(pos.x*x), 
        Math.round(pos.y*y)
      );
    },


    // Move the camera centered to the position v
    focusOn: function (v) {
      var scale = this.get("scale");
      var width = this.get("w");
      var height = this.get("h");
      var x, y;
      if (scale*this.worldwidth > width) {
        if (v.x*scale < (scale*this.worldwidth - width/2) && v.x*scale > width/2) {
          x = -(v.x*scale)+(width/2);
        }
        else if(v.x*scale >= (scale*this.worldwidth-width/2)) {
          x = width-scale*this.worldwidth;
        }
        else {
          x = 0;
        }
        this.set("x", Math.round(x));
      }
      if(scale*this.worldheight > height) {
        if(v.y*scale < (scale*this.worldheight - height/2) && v.y*scale > height/2) {
          y = -(v.y*scale)+(height/2);
        }
        else if(v.y*scale >= (scale*this.worldheight - height/2)) {
          y = (height - scale*this.worldheight);
        }
        else {
          y = 0;
        }
        this.set("y", Math.round(y));
      }
    }


  });

  G.Character = Backbone.Model.extend({
    initialize: function () {
      this.x = this.get("x");
      this.y = this.get("y");
      this.opacity = 1;
      this.shaking = 0;
      this.shakingInterval = 200;
    },
    getPosition: function () {
      return new b2Vec2(
        this.x+(this.shaking && this.shakex || 0), 
        this.y+(this.shaking && this.shakey || 0)
      );
    },
    shake: function () {
      var now = +new Date();
      var last = this.lastShake || 0;
      if (now-last > this.shakingInterval) {
        this.lastShake = now;
        this.shakex = this.shaking*(2*Math.random()-1);
        this.shakey = this.shaking*(2*Math.random()-1);
        if (this.randomAngleOnShake) 
          this.set("angle", this.get("angle")+0.5*Math.PI*(Math.random()-0.5));
      }
    },
    render: function (ctx, camera) {
      if (!this.opacity) return;
      var p = camera.realPositionToCanvas(this.getPosition());
      var cw = camera.get("w");
      var ch = camera.get("h");
      var w = this.get("width")||image.width;
      var h = this.get("height")||image.height;
      var visible = -w/2 < p.x && p.x < cw+w/2 && 
                    -h/2 < p.y && p.y < ch+h/2;
      if (!visible && this.isCaught && this.isCaught()) 
      if (!visible) return;
      if (this.shaking) this.shake();
      var angle = this.get("angle");
      var sprite = this.sprite();
      var image = sprite.image;
      var halfW = Math.round(w/2);
      var halfH = Math.round(h/2);
      var spritex = sprite.x||0;
      var spritey = sprite.y||0;
      var spritew = sprite.w||image.width;
      var spriteh = sprite.h||image.height;
      ctx.save();
      ctx.globalAlpha = this.opacity;
      ctx.translate(p.x, p.y);
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
      var self = this;
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
    isCaught: function () {
      return this.ai && this.ai.caught;
    },
    getOpaqueObject: function (camera) {
      var p = camera.realPositionToCanvas(this.getPosition());
      var large = this.get("height")*0.6;
      var angle = this.get("angle");
      var dx = Math.round(Math.sin(angle)*large/2);
      var dy = Math.round(Math.cos(angle)*large/2);
      var from = new illuminated.Vec2(p.x+dx, p.y+dy);
      var to = new illuminated.Vec2(p.x-dx, p.y-dy);
      return new illuminated.PolygonObject({ points: [from,to] });
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
      var image = G.loader.getResource("people_"+this.sex, 3*this.get("width"), 4*this.get("height"));
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
      this.eatDistance = this.get("width")/3;

      this.caughtPeople = new Backbone.Collection();
    },
    grow: function (factor) {
      this.set("tongueDistance", factor+this.get("tongueDistance"));
      this.set("width", factor+this.get("width"));
      this.set("height", factor+this.get("height"));
      if (factor > 0)
        this.trigger("grow", factor);
      else
        this.trigger("slim", -factor);
    },
    slim: function (factor) {
      this.grow(-factor);
      if (this.get("width") < this.get("vitalWidth")) {
        this.trigger("die");
      }
    },
    getLifespan: function () {
      return (this.get("width")-this.get("vitalWidth"))/this.get("slimSpeed");
    },
    sprite: function () {
      var i = 0;
      var now = +new Date();
      if (this.speed) {
        i = this.lastSprite;
        if (now-this.lastSpriteTime > 50000/Math.abs(this.speed)) {
          this.lastSprite = i = i==1 ? 2 : 1;
          this.lastSpriteTime = now;
          this.trigger("runSpriteSwitch", i);
        }
      }
      var imageId = this.sprites[i];
      return {
        image: G.loader.getResource(imageId, this.get("width"), this.get("height"))
      };
    },
    tongueOut: function (duration) {
      duration = duration || this.tongueSpeedOut;
      this.tongueAnimation = 1;
      this.tongueDuration = duration;
      this.tongueDate = +new Date();
    },
    tongueIn: function (duration) {
      duration = duration || this.tongueSpeedIn;
      this.tongueAnimation = -1;
      this.tongueDuration = duration;
      this.tongueDate = +new Date();
    },

    currentTongueLength: function () {
      var distance = this.get("tongueDistance");
      return this.tongue*distance;
    },

    tongueCollide: function (object) {
      if (this.tongue == 0) return false;
      var v = object.getPosition().Copy();
      v.Subtract(this.getPosition());
      var distance = v.Length();
      var currentTongueLength = this.currentTongueLength();
      if (distance<currentTongueLength) {
        var a = Math.atan2(v.y, v.x)+this.get("angle");
        if (a>Math.PI) a -= 2*Math.PI;
        var DELTA = 0.15;
        if (-DELTA<a && a<DELTA) {
          return true;
        }
      }
      return false;
    },

    onTongueCatch: function (object) {
      var tongueDistance = Math.sqrt(object.getPosition().toIlluminated().dist2(this.getPosition()));
      this.caughtPeople.push(object);
      this.trigger("catch", object, tongueDistance);
    },

    update: function () {
      var now = +new Date();
      if (!this.lastSlim) this.lastSlim=now;
      var slim = (this.slimRemain||0)+this.get("slimSpeed")*(now-this.lastSlim)/1000;
      if (slim > 1) {
        this.lastSlim = now;
        var r = Math.round(slim);
        this.slimRemain = slim - r;
        this.slim(r);
      }
      if (this.caughtPeople.size()) {
        var self = this;
        this.caughtPeople.each(function (people) {
          var tongueDistance = Math.sqrt(people.getPosition().toIlluminated().dist2(self.getPosition()));
          if (self.currentTongueLength() < self.eatDistance) {
            self.trigger("eat", people);
          }
        });
      }
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
        var width = this.get("width");

        var TONGUE_X = Math.round(width/5), 
            TONGUE_Y = Math.round(width/80),
            TONGUE_W = Math.round(width/6);
        var length = Math.round(this.currentTongueLength());
        var angle = this.get("angle");
        var p = camera.realPositionToCanvas(this.getPosition());
        ctx.save();
        ctx.strokeStyle = "#d31744";
        ctx.lineWidth = TONGUE_W;
        ctx.lineCap = "round";
        ctx.translate(p.x, p.y);
        ctx.rotate(-angle);
        ctx.beginPath();
        ctx.moveTo(TONGUE_X, TONGUE_Y);
        ctx.lineTo(length, TONGUE_Y);
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
      if (angle<2*Math.PI) angle += 2*Math.PI;
      if (angle>2*Math.PI) angle -= 2*Math.PI;

      var speed = this.speed(entity);
      entity.speed = speed;
      var x = entity.x + Math.cos(-angle)*speed*t;
      var y = entity.y + Math.sin(-angle)*speed*t;
       
      // FIXME G.map should not exists
      if (G.map.validPosition(new b2Vec2(x, y), entity.get("width")/4)) {
        entity.x = x;
        entity.y = y;
      }

      entity.set("angle", angle);
      this.lastUpdate = now;
      entity.trigger("move", entity);
    }
  });

  G.PeopleAI = G.Controls.extend({
    initialize: function () {
      this.stopped = false;
      this.running = false;
      this.runFactor = 2;
      this.visibility = 250;
      this.lastDecision = +new Date();
      this.a = 2*Math.PI*Math.random();
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
      if (this.caught) return;
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
      if (now-this.lastDecision>this.get("reactionTime")) {
        this.lastDecision = now;
        this.decide(entity);
      }
      G.Controls.prototype.update.apply(this, arguments);
    },
    speed: function (entity) {
      if (this.stopped || this.caught) return 0;
      var speed = entity.get("speed");
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
      this._down = {};
      this.mousedown = 0;
      this.mouseup = 0;
      var self = this;
      $(window).on("keydown", function (e) {
        if (e.keyCode in self.get("keys"))
          e.preventDefault();
        self._down[e.keyCode] = true;
      });
      $(window).on("keyup", function (e) {
        if (e.keyCode in self.get("keys"))
          e.preventDefault();
        self._down[e.keyCode] = false;
      });
      $(window).on("mousemove", function (e) {
        self.set("pointer", { x: e.clientX, y: e.clientY });
      });
      $(window).on("mousedown", function (e) {
        self.mousedown = +new Date();
      });
      $(window).on("mouseup", function (e) {
        self.mouseup = +new Date();
      });
    },
    update: function (entity) {
      var now = +new Date();
      if (now-this.mousedown<100) {
        this.mousedown = 0;
        entity.tongueOut();
      }
      if (now-this.mouseup<100) {
        this.mouseup = 0;
        entity.tongueIn();
      }
      G.Controls.prototype.update.apply(this, arguments);
    },
    setCamera: function (camera) {
      this.camera = camera;
    },
    speed: function (entity) {
      var keys = this.get("keys");
      var forward = this.isDown(keys.forward);
      var backward = this.isDown(keys.backward);
      var speed = 0;
      if (forward && !backward) {
        speed = this.get("forwardSpeed").call(entity);
      }
      else if (backward) {
        speed = -this.get("backwardSpeed").call(entity);
      }
      var pointer = this.get("pointer");
      if (!backward && pointer) {
        var d = this.distanceWithPointer(entity);
        speed *= G.smoothstep(30, 150, d);
      }
      return speed;
    },
    angle: function (entity) {
      var pointer = this.get("pointer");
      if (pointer) {
        pointer = this.camera.canvasToRealPosition(pointer);
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
      pointer = this.camera.canvasToRealPosition(pointer);
      var x = entity.x-pointer.x;
      var y = entity.y-pointer.y;
      return Math.sqrt(x*x+y*y);
    }
  });

}(window.game));
