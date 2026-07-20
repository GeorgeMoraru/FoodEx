import { createTheme } from '@mui/material/styles';

export const getTheme = (mode) => createTheme({
  palette: {
    mode,
    primary: {
      main: mode === 'light' ? '#1976d2' : '#90caf9', // Restored Material Blue
    },
    secondary: {
      main: mode === 'light' ? '#dc004e' : '#f48fb1', // Restored Material Pink
    },
    background: {
      default: mode === 'light' ? '#f5f5f5' : '#121212', // Restored default backgrounds
      paper: mode === 'light' ? '#ffffff' : '#1e1e1e',
    },
    text: {
      primary: mode === 'light' ? '#000000' : '#ffffff', // Restored text colors
      secondary: mode === 'light' ? '#666666' : '#aaaaaa',
    },
  },
  transitions: {
    easing: {
      easeInOut: 'cubic-bezier(0.2, 0, 0, 1)', // Material Design transitions
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
    fontFamily: 'Roboto, sans-serif', // Restored default font family
    button: {
      textTransform: 'uppercase', // Restored classic button uppercase casing
    },
  },
  shape: {
    borderRadius: 4, // Restored classic Material Design sharp corner style (4px)
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 4, // Restored 4px button corners
          padding: '6px 16px',
          transition: 'all 0.3s cubic-bezier(0.2, 0, 0, 1)',
          '&:hover': {
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 8px rgba(0,0,0,0.12)',
          },
          '&:active': {
            transform: 'translateY(0)',
          }
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 4, // Restored 4px card corners
          boxShadow: mode === 'light' 
            ? '0px 2px 1px -1px rgba(0,0,0,0.2), 0px 1px 1px 0px rgba(0,0,0,0.14), 0px 1px 3px 0px rgba(0,0,0,0.12)'
            : '0px 4px 20px rgba(0,0,0,0.3)',
          transition: 'all 0.3s cubic-bezier(0.2, 0, 0, 1)',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: mode === 'light' 
              ? '0px 6px 16px rgba(0,0,0,0.15)'
              : '0px 8px 24px rgba(0,0,0,0.4)',
          },
        },
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          transition: 'all 0.25s cubic-bezier(0.2, 0, 0, 1)',
        }
      }
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 4, // Restored 4px list item corners
          transition: 'all 0.25s cubic-bezier(0.2, 0, 0, 1)',
        }
      }
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          transition: 'all 0.2s cubic-bezier(0.2, 0, 0, 1)',
          '&:hover': {
            transform: 'scale(1.1)',
          },
          '&:active': {
            transform: 'scale(0.95)',
          }
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 4, // Restored 4px chips
          transition: 'all 0.2s cubic-bezier(0.2, 0, 0, 1)',
        }
      }
    },
    MuiCollapse: {
      styleOverrides: {
        root: {
          transition: 'all 0.35s cubic-bezier(0.2, 0, 0, 1) !important', // Forces standard smooth motion on collapses
        }
      }
    }
  },
});

export default getTheme;
