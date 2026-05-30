import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Tooltip from '@mui/material/Tooltip'
import { Laptop, Moon, Sun } from 'lucide-react'
import { useTheme } from './ThemeProvider'

const themeOptions = [
  { value: 'light', label: 'Light mode', icon: Sun },
  { value: 'dark', label: 'Dark mode', icon: Moon },
  { value: 'system', label: 'System mode', icon: Laptop },
]

export default function ModeToggle() {
  const { theme, setTheme } = useTheme()

  const handleThemeChange = (_, nextTheme) => {
    if (nextTheme) setTheme(nextTheme)
  }

  return (
    <ToggleButtonGroup
      exclusive
      value={theme}
      onChange={handleThemeChange}
      size="small"
      aria-label="Theme mode"
    >
      {themeOptions.map(({ value, label, icon: Icon }) => (
        <Tooltip key={value} title={label}>
          <ToggleButton value={value} aria-label={label}>
            <Icon size={16} />
          </ToggleButton>
        </Tooltip>
      ))}
    </ToggleButtonGroup>
  )
}
