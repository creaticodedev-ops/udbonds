import ImageKit from 'imagekit';

let imagekit = null;

/** Returns a configured ImageKit client, or null when credentials are absent. */
export const getImageKit = () => {
  if (imagekit) return imagekit;

  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;

  if (!publicKey || !privateKey || !urlEndpoint) {
    return null;
  }

  imagekit = new ImageKit({ publicKey, privateKey, urlEndpoint });
  return imagekit;
};

export default getImageKit;
