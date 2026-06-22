'use server';

import { supabaseAdmin } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export async function updateOrderStatuses(ids: string[], newStatus: string) {
  if (!ids || ids.length === 0) return { error: 'No orders selected' };

  const { error } = await supabaseAdmin
    .from('orders')
    .update({ status: newStatus })
    .in('id', ids);

  if (error) {
    console.error('Error updating orders:', error);
    return { error: 'Failed to update order status' };
  }

  revalidatePath('/admin/orders');
  return { success: true };
}

export async function deleteOrdersAdmin(ids: string[]) {
  if (!ids || ids.length === 0) return { error: 'No orders selected' };

  const { error } = await supabaseAdmin
    .from('orders')
    .delete()
    .in('id', ids);

  if (error) {
    console.error('Error deleting orders:', error);
    return { error: 'Failed to delete orders' };
  }

  revalidatePath('/admin/orders');
  return { success: true };
}

export async function removeOrderItemAndIssueCredit(orderId: string, orderItemId: string, quantityToRemove: number) {
  try {
    // 1. Fetch the specific order item
    const { data: orderItem, error: itemError } = await supabaseAdmin
      .from('order_items')
      .select('*')
      .eq('id', orderItemId)
      .single();

    if (itemError || !orderItem) throw new Error('Order item not found');
    if (quantityToRemove > orderItem.quantity) throw new Error('Cannot remove more than the existing quantity');

    // 2. Fetch the parent order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) throw new Error('Order not found');

    // 3. Calculate refund amount
    const refundAmount = Number(orderItem.unit_price) * quantityToRemove;

    // 4. Issue the store credit
    const { error: creditError } = await supabaseAdmin
      .from('credits')
      .insert([{
        parent_id: order.parent_id,
        amount: refundAmount,
        source: 'refund',
        order_id: orderId
      }]);

    if (creditError) throw creditError;

    // 5. Update or delete the order item
    if (quantityToRemove === orderItem.quantity) {
      // Remove completely
      await supabaseAdmin.from('order_items').delete().eq('id', orderItemId);
    } else {
      // Reduce quantity
      await supabaseAdmin.from('order_items').update({
        quantity: orderItem.quantity - quantityToRemove,
        total_price: Number(orderItem.total_price) - refundAmount
      }).eq('id', orderItemId);
    }

    // 6. Update the main order totals
    const newGross = Math.max(0, Number(order.gross_amount) - refundAmount);
    const newTotal = Math.max(0, Number(order.total_amount) - refundAmount);

    await supabaseAdmin.from('orders').update({
      gross_amount: newGross,
      total_amount: newTotal
    }).eq('id', orderId);

    revalidatePath('/admin/orders');
    return { success: true, refundAmount };

  } catch (error: any) {
    console.error('Error in removeOrderItemAndIssueCredit:', error);
    return { error: error.message || 'Failed to remove item and issue credit' };
  }
}

export async function createOrderAdmin(data: {
  order_date: string;
  parent_id: string;
  child_id: string;
  items: { dish_id: string; quantity: number; unit_price: number; total_price: number }[];
  gross_amount: number;
  total_amount: number;
  org_id: string;
}) {
  try {
    if (!data.items || data.items.length === 0) {
      throw new Error('Order must contain at least one item');
    }

    // Insert order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        org_id: data.org_id,
        parent_id: data.parent_id,
        child_id: data.child_id,
        order_date: data.order_date,
        gross_amount: data.gross_amount,
        total_amount: data.total_amount,
        status: 'paid'
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // Insert order items
    const orderItems = data.items.map(item => ({
      order_id: order.id,
      dish_id: item.dish_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
      delivery_area: 'classroom'
    }));

    const { error: itemsError } = await supabaseAdmin
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      // rollback order if items fail
      await supabaseAdmin.from('orders').delete().eq('id', order.id);
      throw itemsError;
    }

    revalidatePath('/admin/orders');
    return { success: true };
  } catch (err: any) {
    console.error('Error in createOrderAdmin:', err);
    return { error: err.message || 'Failed to create order' };
  }
}
