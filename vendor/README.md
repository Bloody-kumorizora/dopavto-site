Локальные копии библиотек для 3D-машины (раньше грузились с cdn.jsdelivr.net, который бывает недоступен).
- three@0.160.0: build/three.module.js, нужные модули examples/jsm и распаковщик Draco (libs/draco/gltf)
- three-mesh-bvh@0.8.3: build/index.module.js
Лицензия обеих библиотек — MIT. Обновлять вместе: версия в importmap (index.html) должна совпадать с файлами здесь.
