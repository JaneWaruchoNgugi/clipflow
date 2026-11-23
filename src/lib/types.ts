export type CaptionPosition = 'top' | 'middle' | 'bottom';
export type CaptionStyle = 'box' | 'outline' | 'plain';
export type Format = '9:16' | '1:1' | 'orig';
export type Fit = 'fill' | 'blur' | 'black';
export type Quality = '720' | '1080';

export interface EditSettings {
  caption: string;
  captionSize: number;
  captionPosition: CaptionPosition;
  captionStyle: CaptionStyle;
  captionColor: string;
  format: Format;
  fit: Fit;
  quality: Quality;
}

export interface SavedLink {
  title: string;
  url: string;
  added: number;
}
