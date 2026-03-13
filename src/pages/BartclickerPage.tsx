import { useTranslation } from 'react-i18next'
import SubPage from '../components/SubPage/SubPage'
import BartclickerGame from '../components/BartclickerGame/BartclickerGame'

export default function BartclickerPage() {
  const { t } = useTranslation()

  return (
    <SubPage>
      <div className="bartclicker-page">
        <h1>{t('bartclickerPage.title')}</h1>
        <BartclickerGame />
      </div>
    </SubPage>
  )
}

