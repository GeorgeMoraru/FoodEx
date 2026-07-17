import { createTheme } from '@mui/material/styles';

export const getTheme = (mode) => createTheme({
  palette: {
    mode,
    primary: {
      main: mode === 'light' ? '#2e7d32' : '#81c784', // Forest Green
    },
    secondary: {
      main: mode === 'light' ? '#00796b' : '#4db6ac', // Teal
    },
    background: {
      default: mode === 'light' ? '#f9fbe7' : '#121212', // Slightly warm background for MD3
      paper: mode === 'light' ? '#ffffff' : '#1e1e1e',
    },
    text: {
      primary: mode === 'light' ? '#1b5e20' : '#ffffff',
      secondary: mode === 'light' ? '#558b2f' : '#aaaaaa',
    },
  },
  typography: {
    fontFamily: 'Roboto, sans-serif',
    button: {
      textTransform: 'none', // MD3 uses sentence case for button text
    },
  },
  shape: {
    borderRadius: 16, // Softer rounded corners
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 24, // Pill buttons
          padding: '8px 24px',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: mode === 'light' 
            ? '0px 2px 4px rgba(0,0,0,0.05), 0px 4px 12px rgba(0,0,0,0.05)'
            : '0px 4px 20px rgba(0,0,0,0.3)',
        },
      },
    },
  },
});

export default getTheme;
