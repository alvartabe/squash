import '@testing-library/jest-dom';

class LoadedImage {
  complete = true;
  crossOrigin: string | null = null;
  naturalWidth = 100;
  referrerPolicy = '';
  src = '';

  addEventListener() {}
  removeEventListener() {}
}

Object.defineProperty(window, 'Image', {
  configurable: true,
  value: LoadedImage,
});
