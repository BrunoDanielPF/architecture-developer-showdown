import {TABLE_NAVIGATION} from './table-navigation';

const TABLE_FRAMING={
 overview:{width:23,height:16.8},
 architecture:{width:14,height:11.5}
} as const;

export function initialTableZoom(width:number,height:number,focusArchitecture:boolean):number{
 const frame=focusArchitecture?TABLE_FRAMING.architecture:TABLE_FRAMING.overview;
 const widthAllowance=!focusArchitecture&&width<830?26:frame.width;
 return Math.max(TABLE_NAVIGATION.minZoom,Math.min(TABLE_NAVIGATION.maxZoom,width/widthAllowance,height/frame.height));
}
