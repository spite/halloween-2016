# Pumpkin Jam (halloween-2016)

#### A silly Halloween-themed stravaganza
Pumpkin-based music visualisation using WebGL and Web Audio


3D models and textures by BitGem <a href="https://shop.bitgem3d.com/products/halloween-pumpkins" >Halloween Pumpkins</a>

Made with <a href="https://threejs.org/" >three.js</a>, <a href="https://github.com/spite/THREE.FBOHelper" >THREE.FBOHelper</a>, <a href="https://github.com/kaimallea/isMobile" >isMobile</a>, <a href="https://github.com/video-dev/hls.js" >hls.js</a>

Curl noise from <a href="https://github.com/cabbibo/glsl-curl-noise" >glsl-curl-noise</a> by <a href="https://twitter.com/cabbibo" >@cabbibo</a>

Fog equation adapted from <a href="https://www.npmjs.com/package/glsl-fog">glsl-fog</a> by <a href="https://twitter.com/hughskennedy" >@hughskennedy</a>

Kick detection adapted from <a href="http://jsantell.github.io/dancer.js/" >dancer.js</a> by <a href="https://twitter.com/jsantell" >@jsantell</a>

GLSL Perlin noise from <a href="https://github.com/ashima/webgl-noise/" >webgl-noise</a>

# Assets

BitGem's license doesn't allow redistributing the models, so they're not in this repo. They're kept in a private repo, and the GitHub Pages workflow adds them to the site when it deploys.

# SoundCloud

Songs are resolved by a small Cloudflare Worker in `proxy/`, which keeps the SoundCloud credentials private. The audio streams straight from SoundCloud with hls.js.

# Credits

Jaume Sanchez <a href="https://twitter.com/thespite" >@thespite</a> · <a href="https://www.clicktorelease.com">www.clicktorelease.com</a>

# License

MIT licensed

Copyright (C) 2016 Jaume Sanchez Elias, http://www.clicktorelease.com
