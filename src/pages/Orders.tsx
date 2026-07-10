import { useMemo, useState } from 'react';
import type { Order, OrderStatus, ShippingMethod } from '../lib/types';
import { STATUS_LABEL, STATUS_COLOR } from '../components/badges';
import { IconPlus, IconDownload, IconUpload } from '../components/icons';

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
  onImport,
  onEdit,
  onStatusChange,
  onDelete,
}: {
  orders: Order[];
  onAdd: () => void;
  onImport: () => void;
  onEdit: (order: Order) => void;
  onStatusChange: (id: number, status: OrderStatus) => void;
  onDelete: (id: number) => void;
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
    ...STATUS_ORDER.map((s) => ({ key: s, label: s === 'oem' ? 'OEM' : STATUS_LABEL[s], color: STATUS_COLOR[s] })),
  ];
  const countFor = (k: OrderStatus | 'all') => (k === 'all' ? byTab.length : byTab.filter((o) => o.status === k).length);

  const rev = 'Rev.01-' + new Date().toLocaleDateString('en-GB').replace(/\//g, '');

  return (
    <>
      {/* Tabs + actions */}
      <div className="orders-toolbar">
        <div className="tabs" style={{ marginBottom: 0 }}>
          <button className={`tab${tab === 'company' ? ' active' : ''}`} onClick={() => setTab('company')}>
            ขนส่งบริษัท <span className="tab-count">{companyCount}</span>
          </button>
          <button className={`tab${tab === 'shipping' ? ' active' : ''}`} onClick={() => setTab('shipping')}>
            ขนส่ง <span className="tab-count">{shippingCount}</span>
          </button>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={onImport} title="นำเข้าออเดอร์จากไฟล์ Excel">
            <IconUpload width={16} height={16} /> นำเข้า Excel
          </button>
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
          <button key={c.key} className={`chip${statusFilter === c.key ? ' active' : ''}`} onClick={() => setStatusFilter(c.key)}>
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
                <th style={{ width: 24 }}>#</th>
                <th style={{ width: 108 }}>โรงแรม / โรงพยาบาล</th>
                <th style={{ width: 84 }}>เลขที่ใบสั่งงาน</th>
                <th style={{ width: 132 }}>รายการสินค้า</th>
                <th style={{ width: 48 }}>จำนวน</th>
                <th style={{ width: 40 }}>กล่อง</th>
                <th style={{ width: 96 }}>สถานะ</th>
                <th style={{ width: 108 }}>สถานที่ส่ง / กำหนด</th>
                <th style={{ width: 72 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="loading">ไม่มีใบสั่งขายในหมวดนี้</td></tr>
              ) : (
                filtered.map((o, idx) => (
                  o.items.map((it, j) => (
                    <tr key={`${o.id}-${it.id}`} className={j === o.items.length - 1 ? 'order-end' : ''}>
                      {j === 0 && <td rowSpan={o.items.length} className="cell-top">{idx + 1}</td>}
                      {j === 0 && (
                        <td rowSpan={o.items.length} className="cell-top wrap-hard">
                          <span className={`type-tag ${o.customer_type}`}>{o.customer_type === 'hotel' ? 'โรงแรม' : 'โรงพยาบาล'}</span>
                          <div style={{ fontWeight: 600, marginTop: 4 }}>{o.customer_name}</div>
                        </td>
                      )}
                      {j === 0 && <td rowSpan={o.items.length} className="cell-top"><code>{o.order_no}</code></td>}
                      <td>
                        <div className="col-tag">{it.collection}</div>
                        <div>{it.product_name}</div>
                        {it.note ? <div className="sub" style={{ color: '#f59e0b' }}>* {it.note}</div> : null}
                      </td>
                      <td className="num">{it.qty.toLocaleString()}<div className="sub">{it.pieces_per_box}/กล่อง</div></td>
                      <td className="num" style={{ fontWeight: 700 }}>{it.boxes}</td>
                      {j === 0 && (
                        <td rowSpan={o.items.length} className="cell-top">
                          <select className={`badge b-${o.status} status-select`} value={o.status} onChange={(e) => onStatusChange(o.id, e.target.value as OrderStatus)}>
                            {STATUS_ORDER.map((s) => (
                              <option key={s} value={s}>{s === 'oem' ? 'OEM' : STATUS_LABEL[s]}</option>
                            ))}
                          </select>
                        </td>
                      )}
                      {j === 0 && (
                        <td rowSpan={o.items.length} className="cell-top wrap-hard">
                          <div>{o.delivery_location}</div>
                          <div className="sub" style={{ color: '#94a3b8' }}>{o.ship_date}</div>
                        </td>
                      )}
                      {j === 0 && (
                        <td rowSpan={o.items.length} className="cell-top">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <button className="mini-btn" onClick={() => onEdit(o)}>แก้ไข</button>
                            <button className="mini-btn danger" onClick={() => onDelete(o.id)}>ลบ</button>
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
