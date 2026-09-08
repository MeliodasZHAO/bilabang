import {apiUrl} from './deployment.js';

// Keep source covers and uploaded photos in the same order and attribution model.
export function placeGallery(place) {
  const result=[];
  if(place.image) result.push({id:'cover',src:place.image,caption:place.imageCredit?.caption||place.name,...place.imageCredit});
  for(const photo of place.photos||[]) {
    const src=apiUrl(`/api/photos/${photo.id}`);
    if(!result.some(item=>item.src===src)) result.push({...photo,src,url:photo.sourceUrl});
  }
  return result;
}
