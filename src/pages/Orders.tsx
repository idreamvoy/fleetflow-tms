import { useMemo, useState } from 'react';
import type { Order, OrderStatus, ShippingMethod } from '../lib/types';
import { STATUS_LABEL, STATUS_COLOR } from '../components/badges';
import { IconPlus, IconDownload } from '../components/icons';

const STATUS_ORDER: OrderStatus[] = [
  'unspecified', 'ready', 'waiting_ship', 'delivered', 'failed', 'cod_waiting', 'cod_transferred', 'oem',
];

function exportCsv(orders: Order[]) {
  const rows = [['เลขที่ใบสั่งงาน', 'ลูกค้า', 'ประเภท', 'Collection', 'รายการสินค้า', 'จำนวน', 'ชิ้น/กล่อง', 'กล่อง', 'สถานะ', 'สถานที่ส่ง', 'กำหนดจัดส่ง']];
  orders.forEach((o) =>
    o.items.forEach((it) =>
      rows.push([
        o.order_no, o.customer_name, o.customer_type === 'hotel' ? 'โรงแรม' : 'โรงพยาบาล',
        it.collection, it.product_name, String(it.qty), String(it.pieces_per_box), String(it.boxes),
        STATUS_LABEL[o.status], o.delivery_location, o.ship_date ?? '',
      ])
    )
  );
  const csv = '﻿' + rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Orders({
  orders,
  onAdd,
  onStatusChange,
  onDelete,
  onAddItem,
}: {
  orders: Order[];
  onAdd: () => void;
  onStatusChange: (id: number, status: OrderStatus) => void;
  onDelete: (id: number) => void;
  onAddItem: (id: number) => void;
}) {
  const [tab, setTab] = useState<ShippingMethod>('company');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');

  const byTab = useMemo(() => orders.filter((o) => o.shipping_method === tab), [orders, tab]);
  const companyCount = orders.filter((o) => o.shipping_method === 'company').length;
  const shippingCount = orders.filter((o) => o.shipping_method === 'shipping').length;

  const filtered = useMemo(
    () => (statusFilter === 'all' ? byTab : byTab.filter((o) => o.status === statusFilter)),
    [byTab, statusFilter]
  );

  const chips: Array<{ key: OrderStatus | 'all'; label: string; color?: string }> = [
    { key: 'all', label: 'ทั้งหมด' },
    ...STATUS_ORDER.map((s) => ({ key: s, label: s === 'oem' ? 'OEM // Made to order' : STATUS_LABEL[s], color: STATUS_COLOR[s] })),
  ];
  const countFor = (k: OrderStatus | 'all') => (k === 'all' ? byTab.length : byTab.filter((o) => o.status === k).length);

  const rev = 'Rev.01-' + new Date().toLocaleDateString('en-GB').replace(/\//g, '');

  return (
    <>
      {/* Tabs + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
          <button className={`tab${tab === 'company' ? ' active' : ''}`} onClick={() => setTab('company')}>
            ขนส่งบริษัท <span className="tab-count">{companyCount}</span>
          </button>
          <button className={`tab${tab === 'shipping' ? ' active' : ''}`} onClick={() => setTab('shipping')}>
            ขนส่ง <span className="tab-count">{shippingCount}</span>
          </button>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" style={{ color: '#059669', borderColor: '#a7f3d0' }} onClick={() => exportCsv(filtered)}>
            <IconDownload width={16} height={16} /> ส่งออก Excel
          </button>
          <button className="btn btn-primary" onClick={onAdd}>
            <IconPlus /> เพิ่มใบสั่งขาย
          </button>
        </div>
      </div>

      {/* Status filter chips */}
      <div className="chips">
        <span style={{ color: 'var(--text-2)', fontWeight: 600, alignSelf: 'center' }}>สถานะ:</span>
        {chips.map((c) => (
          <button
            key={c.key}
            className={`chip${statusFilter === c.key ? ' active' : ''}`}
            onClick={() => setStatusFilter(c.key)}
          >
            {c.color && <span className="chip-dot" style={{ background: c.color }} />}
            {c.label}
            <span className="chip-count">{countFor(c.key)}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3>สรุปรายการและวันจัดส่งสินค้า · {tab === 'company' ? 'ขนส่งบริษัท' : 'ขนส่ง'}</h3>
            <div className="sub">{rev}</div>
          </div>
          <span className="sub">{filtered.length} ใบสั่ง</span>
        </div>
        <div className="table-wrap">
          <table className="data orders-table">
            <thead>
              <tr>
                <th>NO.</th>
                <th>โรงแรม / โรงพยาบาล</th>
                <th>เลขที่ใบสั่งงาน</th>
                <th>Collection</th>
                <th>รายการสินค้า</th>
                <th>จำนวน</th>
                <th>ชิ้น/กล่อง</th>
                <th>กล่อง</th>
                <th>สถานะ</th>
                <th>หมายเหตุ</th>
                <th>สถานที่ส่งสินค้า</th>
                <th>กำหนดจัดส่ง</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={13} className="loading">ไม่มีใบสั่งขายในหมวดนี้</td></tr>
              ) : (
                filtered.map((o, idx) => (
                  o.items.map((it, j) => (
                    <tr key={`${o.id}-${it.id}`} className={j === o.items.length - 1 ? 'order-end' : ''}>
                      {j === 0 && <td rowSpan={o.items.length} className="cell-top">{idx + 1}</td>}
                      {j === 0 && (
                        <td rowSpan={o.items.length} className="cell-top">
                          <span className={`type-tag ${o.customer_type}`}>{o.customer_type === 'hotel' ? 'โรงแรม' : 'โรงพยาบาล'}</span>
                          <div style={{ fontWeight: 600, marginTop: 4 }}>{o.customer_name}</div>
                        </td>
                      )}
                      {j === 0 && <td rowSpan={o.items.length} className="cell-top"><code>{o.order_no}</code></td>}
                      <td>{it.collection}</td>
                      <td>{it.product_name}</td>
                      <td>{it.qty.toLocaleString()}</td>
                      <td>{it.pieces_per_box}</td>
                      <td style={{ fontWeight: 600 }}>{it.boxes}</td>
                      {j === 0 && (
                        <td rowSpan={o.items.length} className="cell-top">
                          <select
                            className={`badge b-${o.status} status-select`}
                            value={o.status}
                            onChange={(e) => onStatusChange(o.id, e.target.value as OrderStatus)}
                          >
                            {STATUS_ORDER.map((s) => (
                              <option key={s} value={s}>{s === 'oem' ? 'OEM // Made to order' : STATUS_LABEL[s]}</option>
                            ))}
                          </select>
                        </td>
                      )}
                      <td className="sub" style={{ color: '#94a3b8' }}>{it.note || '—'}</td>
                      {j === 0 && <td rowSpan={o.items.length} className="cell-top">{o.delivery_location}</td>}
                      {j === 0 && <td rowSpan={o.items.length} className="cell-top">{o.ship_date}</td>}
                      {j === 0 && (
                        <td rowSpan={o.items.length} className="cell-top">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <button className="mini-btn" onClick={() => onAddItem(o.id)}>+ รายการ</button>
                            <button className="mini-btn danger" onClick={() => onDelete(o.id)}>ลบใบสั่ง</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
