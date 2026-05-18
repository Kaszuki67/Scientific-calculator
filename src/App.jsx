import { useState, useEffect, useCallback, useRef } from 'react'
import * as math from 'mathjs'

// Create mathjs instance with high precision
const mathjs = math.create({ number: 'BigNumber', precision: 14 })

// Scientific calculator keypad layout (5 columns x 7 rows)
const KEYBOARD_LAYOUT = [
  ['2nd', 'DEG', '(', ')', 'DEL'],
  ['sin', 'cos', 'tan', '^', '√'],
  ['7', '8', '9', '÷', 'log'],
  ['4', '5', '6', '×', 'ln'],
  ['1', '2', '3', '−', 'e^x'],
  ['0', '.', '=', '+', 'π'],
  ['MC', 'MR', 'M+', 'M-', 'AC']
]

// Long-press alternate functions
const LONG_PRESS_ALTS = {
  'sin': 'asin',
  'cos': 'acos',
  'tan': 'atan',
  'log': '10^x',
  'ln': 'e^x',
  '√': '∛',
  '^': 'x²'
}

export default function App() {
  const [expression, setExpression] = useState('')
  const [result, setResult] = useState('')
  const [angleMode, setAngleMode] = useState('DEG') // DEG or RAD
  const [memory, setMemory] = useState(0)
  const [isSecond, setIsSecond] = useState(false)
  const [history, setHistory] = useState([])
  const [toast, setToast] = useState(null)
  const [tooltip, setTooltip] = useState(null)
  const [error, setError] = useState(null)

  const longPressTimer = useRef(null)
  const displayRef = useRef(null)
  const touchStartX = useRef(0)

  // Load history and memory from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('calc_history')
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory))
      } catch (e) {}
    }
    const savedMemory = localStorage.getItem('calc_memory')
    if (savedMemory) {
      try {
        setMemory(parseFloat(savedMemory))
      } catch (e) {}
    }
  }, [])

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem('calc_history', JSON.stringify(history.slice(0, 20)))
  }, [history])

  // Save memory to localStorage
  useEffect(() => {
    localStorage.setItem('calc_memory', memory.toString())
  }, [memory])

  // Format result for display
  const formatResult = (value) => {
    if (value === null || value === undefined || isNaN(value)) return ''
    
    const num = Number(value)
    if (!isFinite(num)) return 'Infinity'
    
    // Use exponential for very large or small numbers
    if (Math.abs(num) >= 1e10 || (Math.abs(num) < 1e-8 && num !== 0)) {
      return num.toExponential(8).replace(/\.?0+e/, 'e').replace(/e\+?(-?)0*(\d+)/, 'e$1$2')
    }
    
    // Remove trailing zeros
    const str = num.toString()
    if (str.includes('.')) {
      return str.replace(/\.?0+$/, '')
    }
    return str
  }

  // Evaluate expression using mathjs
  const evaluateExpression = useCallback((expr) => {
    if (!expr.trim()) return { result: '', error: null }
    
    try {
      // Replace visual operators with mathjs operators
      let processedExpr = expr
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/−/g, '-')
        .replace(/π/g, 'pi')
        .replace(/e(?![x^])/g, 'E') // Handle e constant vs e^x
      
      // Handle factorial (!) - mathjs supports it natively
      
      // Wrap trig functions for DEG mode
      if (angleMode === 'DEG') {
        processedExpr = processedExpr
          .replace(/sin\(([^)]+)\)/g, 'sin(($1) deg)')
          .replace(/cos\(([^)]+)\)/g, 'cos(($1) deg)')
          .replace(/tan\(([^)]+)\)/g, 'tan(($1) deg)')
          .replace(/asin\(([^)]+)\)/g, 'radToDeg(asin($1))')
          .replace(/acos\(([^)]+)\)/g, 'radToDeg(acos($1))')
          .replace(/atan\(([^)]+)\)/g, 'radToDeg(atan($1))')
      }
      
      // Handle power operator ^
      processedExpr = processedExpr.replace(/\^/g, '^')
      
      // Handle square root and cube root
      processedExpr = processedExpr.replace(/√\(/g, 'sqrt(')
      processedExpr = processedExpr.replace(/∛\(/g, 'cbrt(')
      
      // Handle log (base 10) and ln (natural log)
      processedExpr = processedExpr.replace(/log\(/g, 'log10(')
      processedExpr = processedExpr.replace(/ln\(/g, 'log(')
      
      // Handle e^x
      processedExpr = processedExpr.replace(/e\^x/g, 'exp(')
      processedExpr = processedExpr.replace(/exp\(([^)]+)\)/g, 'exp($1)')
      
      // Handle 10^x
      processedExpr = processedExpr.replace(/10\^x/g, 'pow(10,')
      processedExpr = processedExpr.replace(/x²/g, '^2')
      
      const evalResult = mathjs.evaluate(processedExpr)
      
      if (typeof evalResult === 'number' || typeof evalResult === 'bigint') {
        return { result: formatResult(evalResult), error: null }
      } else if (Array.isArray(evalResult) || typeof evalResult === 'object') {
        return { result: String(evalResult), error: null }
      }
      
      return { result: String(evalResult), error: null }
    } catch (err) {
      return { result: '', error: err.message }
    }
  }, [angleMode])

  // Live evaluation as user types
  useEffect(() => {
    if (expression && !expression.endsWith('=')) {
      const { result: evalResult, error: evalError } = evaluateExpression(expression)
      if (evalResult && !evalError) {
        setResult(evalResult)
        setError(null)
      } else {
        setResult('')
      }
    }
  }, [expression, evaluateExpression])

  // Handle button press
  const handleKeyPress = (key) => {
    setError(null)
    
    switch (key) {
      case 'AC':
        setExpression('')
        setResult('')
        break
        
      case 'DEL':
        setExpression(prev => prev.slice(0, -1))
        break
        
      case '=':
        if (expression) {
          const { result: evalResult, error: evalError } = evaluateExpression(expression)
          if (evalError) {
            setError('Invalid input')
          } else if (evalResult) {
            setResult(evalResult)
            setExpression(evalResult + '=')
            // Add to history
            setHistory(prev => [{ expr: expression, result: evalResult }, ...prev].slice(0, 20))
          }
        }
        break
        
      case '2nd':
        setIsSecond(prev => !prev)
        break
        
      case 'DEG':
        setAngleMode(prev => prev === 'DEG' ? 'RAD' : 'DEG')
        break
        
      case 'MC':
        setMemory(0)
        break
        
      case 'MR':
        if (memory !== 0) {
          setExpression(prev => prev + formatResult(memory))
        }
        break
        
      case 'M+':
        if (result) {
          setMemory(prev => prev + parseFloat(result))
        } else if (expression) {
          const { result: evalResult } = evaluateExpression(expression)
          if (evalResult) {
            setMemory(prev => prev + parseFloat(evalResult))
          }
        }
        break
        
      case 'M-':
        if (result) {
          setMemory(prev => prev - parseFloat(result))
        } else if (expression) {
          const { result: evalResult } = evaluateExpression(expression)
          if (evalResult) {
            setMemory(prev => prev - parseFloat(evalResult))
          }
        }
        break
        
      case 'sin':
      case 'cos':
      case 'tan':
        if (isSecond) {
          setExpression(prev => prev + 'a' + key + '(')
        } else {
          setExpression(prev => prev + key + '(')
        }
        break
        
      case 'log':
        if (isSecond) {
          setExpression(prev => prev + '10^x(')
        } else {
          setExpression(prev => prev + 'log(')
        }
        break
        
      case 'ln':
        if (isSecond) {
          setExpression(prev => prev + 'e^x(')
        } else {
          setExpression(prev => prev + 'ln(')
        }
        break
        
      case '√':
        if (isSecond) {
          setExpression(prev => prev + '∛(')
        } else {
          setExpression(prev => prev + '√(')
        }
        break
        
      case '^':
        if (isSecond) {
          setExpression(prev => prev + '^2')
        } else {
          setExpression(prev => prev + '^')
        }
        break
        
      case 'e^x':
        setExpression(prev => prev + 'exp(')
        break
        
      case 'π':
        setExpression(prev => prev + 'π')
        break
        
      default:
        setExpression(prev => prev + key)
    }
  }

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key
      
      if (key >= '0' && key <= '9') {
        handleKeyPress(key)
      } else if (key === '.') {
        handleKeyPress('.')
      } else if (key === '+' || key === '-') {
        handleKeyPress(key)
      } else if (key === '*') {
        handleKeyPress('×')
      } else if (key === '/') {
        handleKeyPress('÷')
      } else if (key === 'Enter' || key === '=') {
        e.preventDefault()
        handleKeyPress('=')
      } else if (key === 'Backspace') {
        handleKeyPress('DEL')
      } else if (key === 'Escape') {
        handleKeyPress('AC')
      } else if (key === '(' || key === ')') {
        handleKeyPress(key)
      } else if (key === '^') {
        handleKeyPress('^')
      } else if (key.toLowerCase() === 'p') {
        handleKeyPress('π')
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [expression, result, angleMode, isSecond])

  // Touch handlers for swipe gestures
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e) => {
    const touchEndX = e.changedTouches[0].clientX
    const diff = touchEndX - touchStartX.current
    
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        // Swipe right - load previous history
        if (history.length > 0) {
          const lastItem = history[0]
          setExpression(lastItem.result)
          setResult('')
        }
      } else {
        // Swipe left - delete
        handleKeyPress('DEL')
      }
    }
  }

  // Long press handler
  const handleLongPressStart = (key) => {
    if (LONG_PRESS_ALTS[key]) {
      setTooltip(LONG_PRESS_ALTS[key])
      longPressTimer.current = setTimeout(() => {
        // Execute alternate function
        const altKey = LONG_PRESS_ALTS[key]
        setTooltip(null)
        
        switch (altKey) {
          case 'asin':
          case 'acos':
          case 'atan':
            setExpression(prev => prev + altKey + '(')
            break
          case '10^x':
            setExpression(prev => prev + '10^x(')
            break
          case 'e^x':
            setExpression(prev => prev + 'exp(')
            break
          case '∛':
            setExpression(prev => prev + '∛(')
            break
          case 'x²':
            setExpression(prev => prev + '^2')
            break
          default:
            setExpression(prev => prev + altKey)
        }
      }, 800)
    }
  }

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    setTooltip(null)
  }

  // Copy result to clipboard
  const copyResult = () => {
    if (result) {
      navigator.clipboard.writeText(result)
      setToast('Copied')
      setTimeout(() => setToast(null), 800)
    }
  }

  // Get button style based on type
  const getButtonStyle = (key) => {
    const baseStyle = "rounded-2xl text-lg font-medium transition-all duration-75 active:scale-[0.97] flex items-center justify-center select-none"
    const sizeStyle = "h-16 w-16 sm:h-[64px] sm:w-[64px]"
    
    if (['=', '+', '−', '×', '÷'].includes(key)) {
      return `${baseStyle} ${sizeStyle} bg-[#8B5CF6] text-white hover:bg-[#7C3AED] active:bg-[#7C3AED]`
    } else if (['sin', 'cos', 'tan', 'log', 'ln', '√', '^', '(', ')', 'DEL', '2nd', 'DEG', 'e^x', 'π'].includes(key)) {
      return `${baseStyle} ${sizeStyle} bg-[#241B36] text-[#B8A8E6] hover:bg-[#2D2142]`
    } else if (['MC', 'MR', 'M+', 'M-', 'AC'].includes(key)) {
      return `${baseStyle} ${sizeStyle} bg-[#241B36] text-[#B8A8E6] hover:bg-[#2D2142]`
    } else {
      return `${baseStyle} ${sizeStyle} bg-[#1C152B] text-[#F5F3FF] hover:bg-[#251D38]`
    }
  }

  // Render button label
  const renderButtonLabel = (key) => {
    if (key === '2nd' && isSecond) {
      return <span className="text-[#A78BFA]">2nd</span>
    }
    if (key === 'DEG') {
      return <span className={angleMode === 'DEG' ? 'text-[#A78BFA]' : ''}>{angleMode}</span>
    }
    return key
  }

  return (
    <div className="min-h-screen bg-[#0B0614] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Display */}
        <div 
          ref={displayRef}
          className="relative mb-4 rounded-3xl p-6 backdrop-blur-md border border-[rgba(167,139,250,0.15)] bg-[rgba(139,92,246,0.08)]"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Memory indicator */}
          {memory !== 0 && (
            <div className="absolute top-3 left-3 text-xs text-[#A78BFA] font-medium">M</div>
          )}
          
          {/* Angle mode toggle pill */}
          <button
            onClick={() => setAngleMode(prev => prev === 'DEG' ? 'RAD' : 'DEG')}
            className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              angleMode === 'DEG' ? 'bg-[#A78BFA] text-white' : 'bg-[#241B36] text-[#B8A8E6]'
            }`}
          >
            {angleMode}
          </button>
          
          {/* History preview */}
          {history.length > 0 && (
            <div 
              className="text-right text-[14px] text-[#B8A8E6] mb-2 cursor-pointer hover:text-[#A78BFA]"
              onClick={() => {
                const lastItem = history[0]
                setExpression(lastItem.expr)
              }}
            >
              {history[0].expr}
            </div>
          )}
          
          {/* Current expression */}
          <div className="text-right text-[44px] text-[#F5F3FF] font-light tabular-nums truncate min-h-[60px]">
            {expression || '0'}
          </div>
          
          {/* Result */}
          {result && (
            <div 
              className="text-right text-[28px] text-[#A78BFA] font-medium tabular-nums truncate cursor-pointer"
              onClick={copyResult}
            >
              = {result}
            </div>
          )}
          
          {/* Error message */}
          {error && (
            <div className="text-right text-[14px] text-[#B8A8E6] mt-2">
              {error}
            </div>
          )}
        </div>
        
        {/* Keypad */}
        <div className="bg-[#141021] rounded-3xl p-4">
          <div className="grid grid-cols-5 gap-2.5">
            {KEYBOARD_LAYOUT.map((row, rowIndex) => (
              <React.Fragment key={rowIndex}>
                {row.map((key) => (
                  <button
                    key={key}
                    className={getButtonStyle(key)}
                    onMouseDown={() => handleLongPressStart(key)}
                    onMouseUp={handleLongPressEnd}
                    onMouseLeave={handleLongPressEnd}
                    onTouchStart={() => handleLongPressStart(key)}
                    onTouchEnd={handleLongPressEnd}
                    onClick={() => handleKeyPress(key)}
                  >
                    {renderButtonLabel(key)}
                  </button>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
        
        {/* Tooltip */}
        {tooltip && (
          <div className="fixed bottom-32 left-1/2 transform -translate-x-1/2 bg-[#241B36] text-[#B8A8E6] px-3 py-2 rounded-lg text-sm shadow-lg z-50">
            {tooltip}
          </div>
        )}
        
        {/* Toast */}
        {toast && (
          <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-[#8B5CF6] text-white px-4 py-2 rounded-full text-sm shadow-lg z-50 animate-pulse">
            {toast}
          </div>
        )}
      </div>
    </div>
  )
}
