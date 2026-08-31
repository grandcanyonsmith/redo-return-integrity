import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { verifyCases } from '../lib/verify-demo'

export function VerifyCasesPage() {
  useEffect(() => {
    document.title = 'Cases · Redo Verify'
  }, [])

  return (
    <div className="vc-main">
      <header className="vc-top">
        <div>
          <h1 className="vc-title">Cases</h1>
          <p className="vc-lead">Orders that hit an elevated signal. None are denied from one trigger.</p>
        </div>
      </header>
      <div className="vc-table-wrap">
        <table className="vc-table">
          <thead>
            <tr>
              <th>Case</th>
              <th>Customer</th>
              <th>Order</th>
              <th>Risk</th>
              <th>Status</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {verifyCases.map((item) => (
              <tr key={item.id}>
                <td><Link to={`/verify/cases/${item.id}`}>{item.id}</Link></td>
                <td>{item.customer}</td>
                <td>{item.orderId}</td>
                <td><span className={`vc-risk vc-risk--${item.risk}`}>{item.risk}</span></td>
                <td>{item.status}</td>
                <td>{item.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
