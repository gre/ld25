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

    var game = G.instance = new G.Game();
    var camera = new G.Camera({
      x: 0,
      y: 0
    });
    var player = new G.Monster({
      x: window.innerWidth/2,
      y: window.innerHeight/2,
      width: 150,
      height: 150,
      angle: 0,
      tongueDistance: 200
    });

    game.setPlayer(player);

    var controls = new G.PlayerControls({
      keys: {
        forward: 38,
        backward: 40
      },
      forwardSpeed: 200, // pixel per sec
      backwardSpeed: 100, // pixel per sec
      rotationSpeed: 5 // radian per sec
    });


    $(window).on("mousedown", function () {
      player.tongueOut(player.tongueSpeedOut);
    });

    $(window).on("mouseup", function () {
      player.tongueIn(player.tongueSpeedIn);
    });

    controls.on("change", function () {
      if (controls.hasChanged("pointer")) {
        game.playerLight.roughness = G.clamp(0, 0.7, controls.distanceWithPointer(player)/400);
      }
    });

    function setViewport (w, h) {
      camera.setSize(w, h);
      canvas.width = w;
      canvas.height = h;
      game.render(ctx, camera);
    }

    setViewport(window.innerWidth, window.innerHeight);
    $(window).on("resize", function () {
      setViewport(window.innerWidth, window.innerHeight);
    });

    var timeline = new G.Timeline();


    timeline.
      once(0, function () {
        player.opacity = 0;
        for (var i=0; i<10; ++i)
          game.addRandomPeople();
      }).
      between(0, 2000, {
        start: function () {
          game.darkmask.color = "rgba(0,0,0,0)";
          game.withLights = false;
        },
        loop: function () {
          var alpha = Math.round(90*G.smoothstep(2000, 3000, timeline.time()))/100;
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
          //var p = G.smoothstep(1000, 2500, timeline.time());
          player.opacity = p;
          camera.shaking = 100*(1-p);
          player.set({
            width: 300-150*p,
            height: 300-150*p
          });
        },
        stop: function(){
          player.opacity = 1;
          camera.shaking = 0;
          player.set({
            width: 150,
            height: 150
          });
        }
      }).
      // Update functions
      before(2000, {
        loop: function () {
          game.update();
        }
      }).
      after(2000, { 
        loop: function (t) {
          controls.update(player);
          game.update();
        }
      });


    function update () {
    }

    (function loop () {
      requestAnimationFrame(loop, game.canvas);
      timeline.update();
      game.render(ctx, camera);
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

  $(document).ready(function() {
    loading();
  });

}(window.game));
