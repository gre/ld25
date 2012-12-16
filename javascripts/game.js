(function(G){

  var loader = G.loader = new G.ImageManager({
    monster: { src: "images/monster.png" },
    monster_walk1: { src: "images/monster_walk1.png" },
    monster_walk2: { src: "images/monster_walk2.png" },
    people_m: { src: "images/men.png" },
    people_f: { src: "images/women.png" }
  }, IMAGES_TOTAL_BYTES);
  
  var sounds = new G.Sounds({
    monsterScream: ""
  });

  function stage (id) {
    $('#'+id).show().siblings('.stage').hide();
  }

  function game () {
    stage("game");
   
    // INIT GAME

    var canvas = $("canvas.game")[0];
    var ctx = canvas.getContext("2d");

    var game = new G.Game();
    var map = G.map = new G.Map({
      width: 2000,
      height: 2000
    });
    game.setMap(map);
    var camera = new G.Camera({
      x: 0,
      y: 0,
      scale: 1
    });
    camera.setWorldSize(map.get("width"), map.get("height"));
    var player = new G.Monster({
      x: map.get("width")/2,
      y: map.get("height")/2,
      width: 220,
      height: 220,
      vitalWidth: 100,
      angle: 0,
      tongueDistance: 200,
      slimSpeed: 2
    });
    game.setPlayer(player);

    var controls = new G.PlayerControls({
      keys: {
        forward: 38,
        backward: 40
      },
      forwardSpeed: function(){ 
        return 200*this.get("tongueDistance")/200 
      }, // pixel per sec
      backwardSpeed: function(){ 
        return 100*this.get("tongueDistance")/200 
      }, // pixel per sec
      rotationSpeed: 5 // radian per sec
    });
    controls.setCamera(camera);

    // DOM Events

    controls.on("change", function () {
      if (controls.hasChanged("pointer")) {
        game.playerLight.roughness = G.clamp(0, 0.7, controls.distanceWithPointer(player)/400);
      }
    });

    function setViewport (w, h) {
      camera.resize(w, h);
      canvas.width = w;
      canvas.height = h;
      game.render(ctx, camera);
    }

    setViewport(window.innerWidth, window.innerHeight);
    $(window).on("resize", function () {
      setViewport(window.innerWidth, window.innerHeight);
    });

    // Custom events
    player.on("eat", function (people) {
      player.grow(4+Math.round(2*Math.random()));

      people._watchPlayerMove && player.off("move", people._watchPlayerMove);
      people.destroy();
    });
    player.on("catch", function (people, distance) {
      people.ai.caught = true;
      people.shakingInterval = 100;
      people.shaking = 5;
      people.randomAngleOnShake = true;
      people._watchPlayerMove = function (player) {
        var angle = player.get("angle");
        people.x = player.x+distance*Math.cos(-angle);
        people.y = player.y+distance*Math.sin(-angle);
      }
      player.on("move", people._watchPlayerMove);
    });

    player.on("die", function () {
      player.destroy();
      end();
    });

    player.on("grow", function () {
      var d = this.get("tongueDistance");
      /*
      // FIXME make it working
      var zoom = Math.max(1, Math.round(d/200));
      camera.setScale(zoom);
      */
    });

    var lastSwitch = 0;
    player.on("runSpriteSwitch", function () {
      lastSwitch = +new Date();
    });

    function updateWalkShake () {
      var now = +new Date();
      var d = now-lastSwitch;
      if (d < 50) {
        camera.shakingInterval = 13;
        camera.shaking = (player.get("tongueDistance")/80);
        camera.shake();
      }
      else {
        camera.shaking = 0;
      }
    }

    // Initial game state
    player.opacity = 0;
    for (var i=0; i<20; ++i)
      game.addRandomPeople();
    game.darkmask.color = "rgba(0,0,0,0)";
    game.withLights = false;

    var storyStart = new G.Timeline();

    var $story = $("#story");
    var $story_h1 = $story.find("h1");
    var $story_h2 = $story.find("h2");
    var $story_h2_points = $story_h2.find(".points");
    storyStart
      .once(0, function () {
        $story.show();
      })
      .between(200, 3500, {
        start: function () {
          $story_h1.addClass("visible");
        },
        stop: function () {
          $story_h1.removeClass("visible");
        }
      })
      .once(1500, function(){ $story_h2_points.text(".") })
      .once(2250, function(){ $story_h2_points.text("..") })
      .once(3000, function(){ $story_h2_points.text("...") })
      .between(1000, 3500, {
        start: function () {
          $story_h2.addClass("visible");
        },
        stop: function () {
          $story_h2.removeClass("visible");
        }
      })
      .once(3900, function () {
        $story.hide();
      })
      ;

    var playerEnterInGame = new G.Timeline();

    playerEnterInGame.
      between(0, 2000, {
        start: function () {
        },
        loop: function (t, p) {
          var alpha = Math.round(90*p)/100;
          game.darkmask.color = "rgba(0,0,0,"+alpha+")";
        },
        stop: function () {
          game.darkmask.color = "rgba(0,0,0,0.9)";
          game.withLights = true;
        }
      }).
      once(1500, function () {
        game.makePeopleAwareOfPlayer(player);
        sounds.play("monsterScream", 0.8);
      }).
      between(1000, 2000, {
        start: function(){
          player.set({
            width: 300,
            height: 300
          });
        },
        loop: function (t, p) {
          player.opacity = p;
          player.set({
            width: 300-150*p,
            height: 300-150*p
          });
        },
        stop: function(){
          player.opacity = 1;
          player.set({
            width: 150,
            height: 150
          });
        }
      }).
      // Update functions
      after(2000, { 
        loop: function (t) {
          controls.update(player);
          setLifespan(Math.round(player.getLifespan()));
        }
      });

    var timeline = new G.Timeline();

    timeline
      .between(2500, 5500, {
        start: function () {
          camera.shakingInterval = 50;
        },
        loop: function (t, p) {
          var s = 30*p;
          s *= (1-G.smoothstep(4000, 5500, t));
          camera.shaking = s;
          camera.shake();
        },
        stop: function () {
          camera.shaking = 0;
        }
      })
      .once(0, function () {
        storyStart.start();
      })
      .after(3000, {
        start: function () {
          playerEnterInGame.start();
        },
        loop: function () {
          playerEnterInGame.update();
        }
      })
      .after(5000, {
        loop: function (t) {
          setTime(Math.round((t-5000)/1000));
        }
      })
      .always({
        loop: function (t) {
          game.update();
          camera.focusOn(player.getPosition());
          updateWalkShake();
        }
      })
      .start();

      
    var time;
    var $time = $(".time");
    function setTime (seconds) {
      if (time === seconds) return;
      time = seconds;
      var mm = Math.floor(seconds/60); if(mm<=9) mm = "0"+mm;
      var ss = seconds%60; if(ss<=9) ss = "0"+ss;
      $time.text(mm+":"+ss);
    }

    var lifespan;
    var $lifespan = $("#lifespan");
    var $lifespan_seconds = $lifespan.find(".seconds");
    function setLifespan (seconds) {
      if (lifespan === seconds) return;
      lifespan = seconds;
      $lifespan_seconds.toggleClass("critic", seconds<10).text(""+seconds);
    }

    var gameOver = false;
    function end () {
      gameOver = true;
      stage("gameOver");
    }

    function update () {
      if (gameOver) return;
      storyStart.update();
      timeline.update();
    }

    (function loop () {
      if (gameOver) return;
      requestAnimationFrame(loop, game.canvas);
      window.stats && stats.begin();
      update();
      game.render(ctx, camera);
      window.stats && stats.end();
    }());
    
  }

  function loading () {
    stage("loader");
    var $loader = $("#loader");
    var $progress = $loader.find(".loader");
    loader.on("progress", function (p) {
      $progress.
      attr("max", p.total).
      attr("value", p.value).
      text(Math.floor(100*p.value/p.total)+" %");
    });
    loader.on("error", function (e) {
      $loader.find('h2').text("Loading failed... Try to reload");
      $loader.find(".error").append($("<li />").text(e.msg));

    });
    loader.once("loaded", function(){
      game();
    });
    loader.load();
  }

  
  $("#tryAgain").click(function(e){
    e.preventDefault();
    window.location.reload();
  });

  $(document).ready(function() {
    loading();
  });

}(window.game));
