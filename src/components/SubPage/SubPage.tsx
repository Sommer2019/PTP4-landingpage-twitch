import type {ReactNode} from 'react'
import {Link, useLocation} from 'react-router-dom'
import {useTranslation} from 'react-i18next'
import Footer from '../Footer/Footer'
import './SubPage.css'

interface SubPageProps {
    children: ReactNode
}

/** Layout-Huelle fuer Unterseiten: Karten-Container mit Footer und automatischem Zurueck-Link. */
export default function SubPage({children}: SubPageProps) {
    const {t} = useTranslation()
    const location = useLocation()
    const pathSegments = location.pathname.split('/').filter(Boolean)
    // Zurueck-Link nur ab der zweiten Pfadebene, sonst gaebe es kein sinnvolles Ziel
    const showBackButton = pathSegments.length > 1
    const backPath = '/' + pathSegments.slice(0, -1).join('/')

    return (
        <main className="subpage-container">
            <div className="subpage-card">
                {children}
                <div className="subpage-back">
                    {showBackButton && (
                        <Link className="btn btn-primary" to={backPath}>
                            {t('back')}
                        </Link>
                    )}
                </div>
            </div>
            <Footer/>
        </main>
    )
}

