import { useSelector } from 'react-redux'
import Header from './Header'
import Sidebar from './Sidebar'

export default function Layout({ children }) {
  const { sidebarOpen } = useSelector((s) => s.ui)

  return (
    <div className="flex min-h-screen flex-col bg-transparent">
      <Header />
      <div className="flex flex-1 pt-[72px]">
        <Sidebar />
        <main
          className={`flex-1 min-w-0 transition-all duration-300 ${
            sidebarOpen ? 'ml-0 md:ml-[272px]' : 'ml-0 md:ml-[92px]'
          } pb-10`}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
