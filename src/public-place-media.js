import {apiUrl} from './deployment.js';

export function isRealPhotoSource(src) {
  return typeof src==='string' && /^(https?:\/\/|\/)/i.test(src.trim()) && !/(?:no-photo|placeholder|\.svg(?:[?#]|$))/i.test(src);
}
export function publicPhoto(place) {
  if(isRealPhotoSource(place.image))return place.image;
  const photo=place.photos?.find(p=>p?.id);
  return photo?apiUrl(`/api/photos/${photo.id}`):null;
}
export function hasPublicPhoto(place) {
  return !place.preview&&!place.demo&&Boolean(publicPhoto(place));
}
