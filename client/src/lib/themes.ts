export const themes = [
  {
    id: 'light',
    name: 'Classic Light',
    type: 'light',
    colors: {
      background: '0 0% 100%',
      foreground: '240 10% 3.9%',
      primary: '240 5.9% 10%',
      nodeBg: '0 0% 100%',
      nodeBorder: '240 5.9% 90%',
      canvasBg: '240 4.8% 98.5%',
      edge: '240 5.9% 80%'
    }
  },
  {
    id: 'dark',
    name: 'Midnight Dark',
    type: 'dark',
    colors: {
      background: '224 71% 4%',
      foreground: '213 31% 91%',
      primary: '210 40% 98%',
      nodeBg: '222 47% 11%',
      nodeBorder: '216 34% 17%',
      canvasBg: '224 71% 4%',
      edge: '216 34% 30%'
    }
  },
  {
    id: 'ocean',
    name: 'Ocean Blue',
    type: 'light',
    colors: {
      background: '210 40% 98%',
      foreground: '222 47% 11%',
      primary: '199 89% 48%',
      nodeBg: '0 0% 100%',
      nodeBorder: '199 89% 85%',
      canvasBg: '204 33% 97%',
      edge: '199 89% 80%'
    }
  },
  {
    id: 'forest',
    name: 'Forest Green',
    type: 'light',
    colors: {
      background: '150 30% 98%',
      foreground: '164 40% 15%',
      primary: '142 76% 36%',
      nodeBg: '0 0% 100%',
      nodeBorder: '142 76% 85%',
      canvasBg: '150 20% 96%',
      edge: '142 76% 80%'
    }
  },
  {
    id: 'custom',
    name: 'Custom',
    type: 'dark',
    colors: {
      background: '222 47% 6%',
      foreground: '210 40% 98%',
      primary: '142 76% 36%',
      nodeBg: '0 0% 100%',
      nodeBorder: '210 16% 86%',
      canvasBg: '222 47% 6%',
      edge: '215 20% 65%'
    }
  }
] as const;

export type ThemeId = typeof themes[number]['id'];
