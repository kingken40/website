declare module 'jspdf' {
  export class jsPDF {
    constructor(orientation?: string, unit?: string, format?: string | number[]);
    
    addImage(
      imageData: string | HTMLImageElement | HTMLCanvasElement,
      format: string,
      x: number,
      y: number,
      width?: number,
      height?: number,
      alias?: string,
      compression?: string,
      rotation?: number
    ): jsPDF;
    
    addPage(format?: string | number[], orientation?: string): jsPDF;
    save(filename?: string): jsPDF;
    output(type?: string, options?: any): any;
    
    internal: {
      pageSize: {
        getWidth(): number;
        getHeight(): number;
      };
    };
  }
}