/**
 * Explorer Image Aggregation (Shuffle + Explicit src)
 *
 * Explorer owns image paths.
 * script.js only renders what it is given.
 */

(function () {
  console.log('[Explorer] Initializing mixed gallery with explicit src');

  if (!Array.isArray(window.pfpImages)) {
    console.error('[Explorer] window.pfpImages missing');
    window.activeImages = [];
    return;
  }

  if (!Array.isArray(window.bannerImages)) {
    console.error('[Explorer] window.bannerImages missing');
    window.activeImages = [];
    return;
  }

  function normalize(images, source, basePath) {
    return images.map(item => ({
      file: item.file,
      tags: Array.isArray(item.tags) ? item.tags : [],
      source: source,
      src: `${basePath}/${item.file}`
    }));
  }

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  const mixedImages = shuffle([
    ...normalize(window.pfpImages, 'pfp', '/pfps/images'),
    ...normalize(window.bannerImages, 'banner', '/banners/images')
  ]);

  // Authoritative dataset for Explorer
  window.activeImages = mixedImages;

  // Also override legacy source so script.js renders correctly
  window.pfpImages = mixedImages;

  console.log(
    '[Explorer] Mixed gallery ready:',
    mixedImages.length,
    'images'
  );
})();