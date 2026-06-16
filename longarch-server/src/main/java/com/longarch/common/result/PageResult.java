package com.longarch.common.result;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.Data;

import java.util.List;

@Data
public class PageResult<T> {

    private List<T> list;
    private int pageNo;
    private int pageSize;
    private long total;

    public static <T> PageResult<T> of(List<T> list, int pageNo, int pageSize, long total) {
        PageResult<T> result = new PageResult<>();
        result.setList(list);
        result.setPageNo(pageNo);
        result.setPageSize(pageSize);
        result.setTotal(total);
        return result;
    }

    public static <T> PageResult<T> from(Page<?> page, List<T> voList) {
        PageResult<T> result = new PageResult<>();
        result.setList(voList);
        result.setPageNo((int) page.getCurrent());
        result.setPageSize((int) page.getSize());
        result.setTotal(page.getTotal());
        return result;
    }
}
