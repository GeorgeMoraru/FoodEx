import { createTheme } from '@mui/material/styles';

export const getTheme = (mode) => createTheme({
  palette: {
    mode,
    primary: {
      main: mode === 'light' ? '#2e7d32' : '#81c784', // Material Forest Green
    },
    secondary: {
      main: mode === 'light' ? '#388e3c' : '#a5d6a7',
    },
    background: {
      default: mode === 'light' ? '#f8fafd' : '#111411', // MD3 Surface background
      paper: mode === 'light' ? '#ffffff' : '#1a1d1a',
    },
    text: {
      primary: mode === 'light' ? '#1a1c19' : '#e2e3dd',
      secondary: mode === 'light' ? '#434940' : '#c3c8bc',
    },
  },
  transitions: {
    easing: {
      easeInOut: 'cubic-bezier(0.2, 0, 0, 1)', // Material 3 Emphasized
      easeOut: 'cubic-bezier(0.05, 0.7, 0.1, 1)', // Decelerate
      easeIn: 'cubic-bezier(0.3, 0, 0.8, 0.15)', // Accelerate
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
    fontFamily: 'Outfit, Roboto, sans-serif',
    button: {
      textTransform: 'none', // MD3 uses mixed case buttons
      fontWeight: 'bold',
    },
  },
  shape: {
    borderRadius: 12, // MD3 Rounded corners for components
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 24, // MD3 Pills buttons
          padding: '8px 24px',
          transition: 'all 0.3s cubic-bezier(0.2, 0, 0, 1)',
          '&:hover': {
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
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
          borderRadius: 16, // MD3 Card corners
          boxShadow: 'none',
          border: '1px solid',
          borderColor: mode === 'light' ? '#e2e8f0' : '#2e332e',
          transition: 'all 0.3s cubic-bezier(0.2, 0, 0, 1)',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: mode === 'light' 
              ? '0px 8px 24px rgba(0,0,0,0.08)'
              : '0px 8px 24px rgba(0,0,0,0.4)',
            borderColor: mode === 'light' ? '#cbd5e1' : '#434940',
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
          borderRadius: 8,
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
          borderRadius: 8, // MD3 Rounded Chips
          transition: 'all 0.2s cubic-bezier(0.2, 0, 0, 1)',
        }
      }
    },
    MuiCollapse: {
      styleOverrides: {
        root: {
          transition: 'all 0.35s cubic-bezier(0.2, 0, 0, 1) !important', // Forces MD3 Emphasized curve on expands
        }
      }
    }
  },
});

export default getTheme;
