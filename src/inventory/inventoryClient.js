import { supabase, getPlayerJoinCode } from '../supabaseClient';

function roleIsDm(role) {
  return role === 'dm';
}

function playerJoinCode(role, explicitJoinCode) {
  if (roleIsDm(role)) return null;
  return explicitJoinCode || getPlayerJoinCode() || null;
}

async function rpc(name, params) {
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw error;
  return data;
}

export async function inventoryGetSnapshot({ playerProfileId, role, joinCode }) {
  const data = await rpc('inventory_get_snapshot', {
    p_player_profile_id: playerProfileId,
    p_join_code: playerJoinCode(role, joinCode),
  });
  if (!data) return null;
  if (Array.isArray(data)) return data[0] || null;
  return data;
}

export async function inventoryGetSummary({ playerProfileId, role, joinCode }) {
  const rows = await rpc('inventory_get_summary', {
    p_player_profile_id: playerProfileId,
    p_join_code: playerJoinCode(role, joinCode),
  });
  return rows?.[0] || null;
}

export async function inventoryGetSummariesForProfiles(profileIds = []) {
  const rows = await rpc('inventory_get_summaries_for_profiles', {
    p_profile_ids: profileIds,
  });
  return rows || [];
}

export async function inventorySearchCatalog({ profileId, role, query = '', joinCode }) {
  return rpc('inventory_search_catalog', {
    p_query: query,
    p_player_profile_id: profileId,
    p_join_code: playerJoinCode(role, joinCode),
    p_limit: 25,
  });
}

export async function inventoryUpsertItem({ playerProfileId, role, joinCode, itemMasterId = null, customName = null, quantity = 1, notes = null, itemRowId = null }) {
  return rpc('inventory_upsert_item', {
    p_player_profile_id: playerProfileId,
    p_join_code: playerJoinCode(role, joinCode),
    p_item_master_id: itemMasterId,
    p_custom_name: customName,
    p_quantity: quantity,
    p_notes: notes,
    p_item_row_id: itemRowId,
  });
}

export async function inventoryRemoveItem({ playerProfileId, role, itemRowId, quantity = null, reason = 'remove', joinCode }) {
  return rpc('inventory_remove_item', {
    p_player_profile_id: playerProfileId,
    p_item_row_id: itemRowId,
    p_quantity: quantity,
    p_reason: reason,
    p_join_code: playerJoinCode(role, joinCode),
  });
}

export async function inventorySetCurrency({ playerProfileId, role, joinCode, pp, gp, sp, cp }) {
  return rpc('inventory_set_currency', {
    p_player_profile_id: playerProfileId,
    p_pp: pp,
    p_gp: gp,
    p_sp: sp,
    p_cp: cp,
    p_join_code: playerJoinCode(role, joinCode),
  });
}

export async function inventoryCreateTransfer({ senderProfileId, receiverProfileId, role, joinCode, itemRowId = null, itemQuantity = null, currencyType = null, currencyAmount = null, note = null }) {
  const rows = await rpc('inventory_create_transfer', {
    p_sender_profile_id: senderProfileId,
    p_receiver_profile_id: receiverProfileId,
    p_join_code: playerJoinCode(role, joinCode),
    p_item_row_id: itemRowId,
    p_item_quantity: itemQuantity,
    p_currency_type: currencyType,
    p_currency_amount: currencyAmount,
    p_note: note,
  });
  return rows?.[0] || null;
}

export async function inventoryRespondTransfer({ transferId, receiverProfileId, accept, joinCode }) {
  return rpc('inventory_respond_transfer', {
    p_transfer_id: transferId,
    p_receiver_profile_id: receiverProfileId,
    p_accept: !!accept,
    p_join_code: joinCode || getPlayerJoinCode(),
  });
}

export async function inventoryGetPendingIncoming({ playerProfileId, joinCode }) {
  return rpc('inventory_get_pending_incoming', {
    p_player_profile_id: playerProfileId,
    p_join_code: joinCode || getPlayerJoinCode(),
  });
}

export async function inventoryGetLog({ playerProfileId }) {
  return rpc('inventory_get_log', {
    p_player_profile_id: playerProfileId,
  });
}

export async function inventoryGetTransferTargets({ playerProfileId, role, joinCode }) {
  return rpc('inventory_get_transfer_targets', {
    p_player_profile_id: playerProfileId,
    p_join_code: playerJoinCode(role, joinCode),
  });
}

export async function inventoryDmAwardCurrency({ encounterId = null, receiverProfileId = null, currencyType = 'gp', amount = 0, awardAll = false, note = null }) {
  return rpc('dm_inventory_award_currency', {
    p_encounter_id: encounterId,
    p_receiver_profile_id: receiverProfileId,
    p_currency_type: currencyType,
    p_amount: amount,
    p_award_all: !!awardAll,
    p_note: note,
  });
}

export async function inventoryDmShopAssignItem({ receiverProfileId, shopInventoryId, quantity = 1, priceMode = 'listed', customPriceGp = null, note = null }) {
  return rpc('dm_shop_assign_inventory_item', {
    p_receiver_profile_id: receiverProfileId,
    p_shop_inventory_id: shopInventoryId,
    p_quantity: quantity,
    p_price_mode: priceMode,
    p_custom_price_gp: customPriceGp,
    p_note: note,
  });
}
