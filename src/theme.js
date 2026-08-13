import { createTheme } from '@mui/material/styles';

export const getTheme = (mode) => createTheme({
  palette: {
    mode,
    primary: {
      main: mode === 'light' ? '#1976d2' : '#90caf9', // Material Blue
    },
    secondary: {
      main: mode === 'light' ? '#dc004e' : '#f48fb1', // Material Pink
    },
    background: {
      default: mode === 'light' ? '#f5f5f5' : '#121212',
      paper: mode === 'light' ? '#ffffff' : '#1e1e1e',
    },
    text: {
      primary: mode === 'light' ? '#000000' : '#ffffff',
      secondary: mode === 'light' ? '#666666' : '#aaaaaa',
    },
  },
  transitions: {
    easing: {
      easeInOut: 'cubic-bezier(0.2, 0, 0, 1)', // Material Design 60fps easing curve
      easeOut: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
      easeIn: 'cubic-bezier(0.3, 0, 0.8, 0.15)',
      sharp: 'cubic-bezier(0.2, 0, 0, 1)',
    },
    duration: {
      shortest: 150,
      shorter: 200,
      short: 250,
      standard: 300,
      complex: 375,
    }
  },
  typography: {
    fontFamily: 'Roboto, sans-serif',
    button: {
      textTransform: 'uppercase',
    },
  },
  shape: {
    borderRadius: 4,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '4px',
          padding: '6px 16px',
          backfaceVisibility: 'hidden',
          transform: 'translateZ(0)',
          willChange: 'transform, box-shadow, background-color',
          transition: 'transform 0.2s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.2s cubic-bezier(0.2, 0, 0, 1), background-color 0.2s cubic-bezier(0.2, 0, 0, 1), border-color 0.2s cubic-bezier(0.2, 0, 0, 1)',
          '&:hover': {
            transform: 'translateY(-1px) translateZ(0)',
            boxShadow: '0 4px 8px rgba(0,0,0,0.12)',
          },
          '&:active': {
            transform: 'translateY(0) translateZ(0)',
          }
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '4px',
          boxShadow: mode === 'light' 
            ? '0px 2px 1px -1px rgba(0,0,0,0.2), 0px 1px 1px 0px rgba(0,0,0,0.14), 0px 1px 3px 0px rgba(0,0,0,0.12)'
            : '0px 4px 20px rgba(0,0,0,0.3)',
          backfaceVisibility: 'hidden',
          transform: 'translateZ(0)',
          willChange: 'transform, box-shadow, border-color',
          transition: 'transform 0.25s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.25s cubic-bezier(0.2, 0, 0, 1), border-color 0.25s cubic-bezier(0.2, 0, 0, 1), background-color 0.25s cubic-bezier(0.2, 0, 0, 1)',
          '&:hover': {
            transform: 'translateY(-2px) translateZ(0)',
            boxShadow: mode === 'light' 
              ? '0px 6px 16px rgba(0,0,0,0.15)'
              : '0px 8px 24px rgba(0,0,0,0.4)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: '4px',
          transition: 'box-shadow 0.25s cubic-bezier(0.2, 0, 0, 1), background-color 0.25s cubic-bezier(0.2, 0, 0, 1)',
        }
      }
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          transition: 'background-color 0.2s cubic-bezier(0.2, 0, 0, 1), transform 0.2s cubic-bezier(0.2, 0, 0, 1)',
        }
      }
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: '4px',
          transition: 'background-color 0.2s cubic-bezier(0.2, 0, 0, 1), transform 0.2s cubic-bezier(0.2, 0, 0, 1)',
        }
      }
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          backfaceVisibility: 'hidden',
          willChange: 'transform',
          transition: 'transform 0.2s cubic-bezier(0.2, 0, 0, 1), background-color 0.2s cubic-bezier(0.2, 0, 0, 1)',
          '&:hover': {
            transform: 'scale(1.1) translateZ(0)',
          },
          '&:active': {
            transform: 'scale(0.95) translateZ(0)',
          }
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: '4px',
          transition: 'transform 0.2s cubic-bezier(0.2, 0, 0, 1), background-color 0.2s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.2s cubic-bezier(0.2, 0, 0, 1)',
          '&:hover': {
            transform: 'translateY(-1px) translateZ(0)',
          }
        }
      }
    },
    MuiTab: {
      styleOverrides: {
        root: {
          transition: 'color 0.2s cubic-bezier(0.2, 0, 0, 1), opacity 0.2s cubic-bezier(0.2, 0, 0, 1)',
        }
      }
    },
    MuiCollapse: {
      styleOverrides: {
        root: {
          willChange: 'height',
          transition: 'height 0.3s cubic-bezier(0.2, 0, 0, 1) !important',
        }
      }
    }
  },
});

export default getTheme;
