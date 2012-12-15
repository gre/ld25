(function(G){

  var loader = G.loader = new G.ImageManager({
    monster: { src: "images/monster.png" },
    monster_walk1: { src: "images/monster_walk1.png" },
    monster_walk2: { src: "images/monster_walk2.png" },
    people_m: { src: "images/men.png" },
    people_f: { src: "images/women.png" }
  }, IMAGES_TOTAL_BYTES);
  

  function stage (id) {
    $('#'+id).show().siblings('.stage').hide();
  }

  function game () {
    stage("game");
   
    var canvas = $("canvas.game")[0];
    var ctx = canvas.getContext("2d");

    var game = new G.Game();
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

    window.player = player;

    game.setPlayer(player);

    var controls = new G.PlayerControls({
      keys: {
        forward: 38,
        backward: 40
      },
      forwardSpeed: 200, // pixel per sec
      backwardSpeed: 100, // pixel per sec
      rotationSpeed: 3 // radian per sec
    });

    function addRandomPeople () {
      var people = new G.People({
        x: Math.random()*window.innerWidth,
        y: Math.random()*window.innerHeight,
        width: 80,
        height: 80,
        sex: Math.random()>.5 ? "m" : "f",
        model: Math.floor(Math.random()*4)
      });
      var ai = new G.PeopleAI({
        endurance: 10,
          speed: 80+Math.round(40*Math.random())
      });
      ai.opponents.push(player);
      people.setAI(ai);
      game.people.push(people);
    }

    for (var i=0; i<10; ++i)
      addRandomPeople();

    var i = 0;
    function update () {
      controls.update(player);

      if (i++%20==0) {
        addRandomPeople();
      }

      game.people.each(function (people) {
        people.update();
      });
    }

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

    (function loop () {
      requestAnimationFrame(loop, game.canvas);
      update();
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
