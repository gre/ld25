(function(G){

  G.clamp = function (min, max, value) { return Math.max(min, Math.min(max, value)) };
  G.smoothstep = function (min, max, value) { return Math.max(0, Math.min(1, (value-min)/(max-min))); };
}(window.game));
